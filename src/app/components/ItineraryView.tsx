import { useEffect, useRef, useState } from 'react';
import { Destination } from '@/app/types/destination';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Separator } from '@/app/components/ui/separator';
import { Input } from '@/app/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { TravelModeBadges } from '@/app/components/TravelModeBadges';
import { DestinationLocationPanel } from '@/app/components/DestinationLocationPanel';
import { DestinationImageGallery } from '@/app/components/DestinationImageGallery';
import { ZoomableImage } from '@/app/components/ZoomableImage';
import { ItineraryDestinationCard } from '@/app/components/ItineraryDestinationCard';
import { GeoPoint } from '@/app/utils/travel';
import { Calendar, Trash2, Download, Wallet, Star, Map as MapIcon, Clock3 } from 'lucide-react';
import { calculateItinerarySchedule, getDestinationStayHours } from '@/app/utils/recommendation';
import { formatInterestList } from '@/app/utils/interests';
import { SavedItinerary } from '@/app/types/saved-itinerary';
import type { ItineraryStop, SavedItineraryProgress } from '@/app/types/saved-itinerary';
import { createItinerary } from '@/app/api/itineraries';
import type { RecommendationBudgetSummary } from '@/app/api/recommendations';
import { formatPeso } from '@/app/utils/currency';
import { toUserFacingErrorMessage } from '@/app/utils/user-facing-error';
import { buildGoogleMapsRouteUrl, getDaySegmentDistances } from '@/app/utils/google-maps';
import { buildDayTimeline } from '@/app/utils/itinerary-timeline';
import type { PDFImage } from 'pdf-lib';
import { addDays, format, isValid, parseISO, startOfDay } from 'date-fns';

interface ItineraryViewProps {
  destinations: Destination[];
  allDestinations: Destination[];
  tripDays: number;
  selectedDates?: string[];
  isSavedItinerary?: boolean;
  savedItineraryId?: string;
  savedProgress?: SavedItineraryProgress;
  userInterests?: string[];
  interestRanks?: Record<string, number>;
  recommendationAlgorithm?: string | null;
  recommendationBudget?: RecommendationBudgetSummary | null;
  onAddDestination: (destination: Destination) => void;
  onRemoveDestination: (destinationId: string) => void;
  onReset: () => void;
  onViewSavedItineraries?: () => void;
  onSaveSuccess?: (savedItinerary: SavedItinerary) => void;
  onRateDestination?: (destination: Destination, rating: number) => void;
  onSavedProgressChange?: (progress: SavedItineraryProgress) => void;
  destinationRatings?: Record<string, number>;
  userLocation?: GeoPoint | null;
}

export function ItineraryView({
  destinations,
  allDestinations,
  tripDays,
  selectedDates = [],
  isSavedItinerary = false,
  savedItineraryId,
  savedProgress,
  userInterests = [],
  interestRanks,
  recommendationAlgorithm,
  recommendationBudget,
  onAddDestination,
  onRemoveDestination,
  onReset,
  onViewSavedItineraries,
  onSaveSuccess,
  onRateDestination,
  onSavedProgressChange,
  destinationRatings,
  userLocation
}: ItineraryViewProps) {
  const toStopKey = (day: number, sequence: number, destinationId: string) => `${day}-${sequence}-${destinationId}`;
  const minutesToTimeInput = (minutesFromMidnight: number) => {
    const normalized = ((Math.round(minutesFromMidnight) % 1440) + 1440) % 1440;
    const hours = Math.floor(normalized / 60).toString().padStart(2, '0');
    const minutes = (normalized % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };
  const sanitizeStopTime = (value: string): string => {
    const trimmed = value.trim();
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(trimmed) ? trimmed : '';
  };
  const buildComputedStops = (scheduleMap: Map<number, Destination[]>): ItineraryStop[] => {
    const computed: ItineraryStop[] = [];
    Array.from(scheduleMap.entries()).forEach(([day, dayDestinations]) => {
      const timeline = buildDayTimeline(dayDestinations, { day });
      dayDestinations.forEach((destination, sequence) => {
        const slot = timeline[sequence];
        if (!slot) return;
        computed.push({
          destinationId: destination.id,
          day,
          sequence,
          startTime: minutesToTimeInput(slot.startMinutes),
          endTime: minutesToTimeInput(slot.endMinutes),
        });
      });
    });
    return computed;
  };
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isCompletionDialogOpen, setIsCompletionDialogOpen] = useState(false);
  const [activeCompletedDay, setActiveCompletedDay] = useState<number | null>(null);
  const [pendingCompletedDays, setPendingCompletedDays] = useState<number[]>([]);
  const [ratingUnlockedDays, setRatingUnlockedDays] = useState<Set<number>>(new Set());
  const [saveNameDraft, setSaveNameDraft] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [finishedDestinationKeys, setFinishedDestinationKeys] = useState<Set<string>>(
    () => new Set(savedProgress?.finishedEntryKeys ?? [])
  );
  const [stops, setStops] = useState<ItineraryStop[]>([]);
  const [expandedAddDay, setExpandedAddDay] = useState<number | null>(null);
  const saveRequestInFlight = useRef(false);
  const prevCompletedDaysRef = useRef<Set<number>>(new Set());
  const lastHydratedSavedItineraryRef = useRef<string | null>(null);
  const formatHours = (value: number) => {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
  };
  const getDestinationDurationHours = (destination: Destination) => {
    if (Number.isFinite(destination.durationHours) && (destination.durationHours as number) > 0) {
      return destination.durationHours as number;
    }
    if (Number.isFinite(destination.duration) && destination.duration > 0) {
      return destination.duration;
    }
    return null;
  };
  const schedule = calculateItinerarySchedule(destinations, tripDays, userInterests, interestRanks);
  const emptyDays = Array.from(schedule.entries()).filter(([, dayDestinations]) => dayDestinations.length === 0).length;
  const getEntryKey = (destination: Destination, day: number, index: number) =>
    `${day}-${index}-${destination.id || destination.name}`;
  const itineraryEntryKeys = Array.from(schedule.entries()).flatMap(([day, dayDestinations]) =>
    dayDestinations.map((destination, index) => getEntryKey(destination, day, index))
  );
  const itineraryEntrySignature = itineraryEntryKeys.join('|');
  const availableDestinations = allDestinations.filter(
    (candidate) => !destinations.some((selected) => selected.id === candidate.id)
  );
  
  const totalCost = destinations.reduce((sum, dest) => sum + dest.estimatedCost, 0);
  const totalDuration = destinations.reduce((sum, dest) => sum + getDestinationStayHours(dest), 0);
  const isKnapsack =
    typeof recommendationAlgorithm === 'string' &&
    recommendationAlgorithm.trim().toLowerCase() === 'knapsack';
  const maxBudget = recommendationBudget?.maxBudget;
  const totalSelectedCost = recommendationBudget?.totalSelectedCost ?? totalCost;
  const remainingBudget = recommendationBudget?.remainingBudget;
  const utilizationPct = recommendationBudget?.utilizationPct;
  const showBudgetSummary = Number.isFinite(maxBudget) && (maxBudget as number) > 0;
  const effectiveSelectedDates = (() => {
    const targetDays = Math.max(1, tripDays);
    const normalizedDates = selectedDates
      .map((dateIso) => parseISO(dateIso))
      .filter((date) => isValid(date))
      .sort((a, b) => a.getTime() - b.getTime())
      .map((date) => startOfDay(date));

    const dedupedDates: Date[] = [];
    const seen = new Set<string>();
    normalizedDates.forEach((date) => {
      const key = format(date, 'yyyy-MM-dd');
      if (seen.has(key)) return;
      seen.add(key);
      dedupedDates.push(date);
    });

    if (dedupedDates.length >= targetDays) {
      return dedupedDates.slice(0, targetDays).map((date) => date.toISOString());
    }

    const startDate = dedupedDates.length > 0 ? dedupedDates[0] : startOfDay(new Date());
    const filledDates = Array.from({ length: targetDays }, (_, index) => addDays(startDate, index));
    return filledDates.map((date) => date.toISOString());
  })();
  const getDayDateLabel = (day: number): string | null => {
    const dateIso = effectiveSelectedDates[day - 1];
    if (!dateIso) return null;
    const parsed = parseISO(dateIso);
    if (!isValid(parsed)) return null;
    return format(parsed, 'MMMM d, yyyy');
  };
  const isDayFinished = (day: number) => {
    const dayDestinations = schedule.get(day) ?? [];
    if (dayDestinations.length === 0) return false;
    return dayDestinations.every((destination, index) =>
      finishedDestinationKeys.has(getEntryKey(destination, day, index))
    );
  };

  useEffect(() => {
    const computedDefaults = buildComputedStops(schedule);
    const validKeys = new Set(computedDefaults.map((stop) => toStopKey(stop.day, stop.sequence, stop.destinationId)));

    setStops((previous) => {
      const existingByKey = new Map<string, ItineraryStop>();
      previous.forEach((stop) => {
        const key = toStopKey(stop.day, stop.sequence, stop.destinationId);
        if (!validKeys.has(key)) return;
        existingByKey.set(key, {
          ...stop,
          startTime: sanitizeStopTime(stop.startTime),
          endTime: sanitizeStopTime(stop.endTime),
        });
      });

      return computedDefaults.map((stop) => {
        const key = toStopKey(stop.day, stop.sequence, stop.destinationId);
        const existing = existingByKey.get(key);
        return existing
          ? {
              ...stop,
              startTime: existing.startTime || stop.startTime,
              endTime: existing.endTime || stop.endTime,
            }
          : stop;
      });
    });
  }, [itineraryEntrySignature]);

  useEffect(() => {
    const validKeys = new Set(itineraryEntryKeys);
    setFinishedDestinationKeys((prev) => {
      const next = new Set(Array.from(prev).filter((key) => validKeys.has(key)));
      return next.size === prev.size ? prev : next;
    });
  }, [itineraryEntryKeys]);

  useEffect(() => {
    if (!isSavedItinerary || !savedItineraryId) return;
    if (lastHydratedSavedItineraryRef.current === savedItineraryId) return;

    const validKeys = new Set(itineraryEntryKeys);
    const nextFinishedKeys = new Set(
      (savedProgress?.finishedEntryKeys ?? []).filter((key) => validKeys.has(key))
    );
    const nextUnlockedDays = new Set(
      (savedProgress?.ratingUnlockedDays ?? []).filter((day) => Number.isFinite(day) && day > 0)
    );

    setFinishedDestinationKeys(nextFinishedKeys);
    setRatingUnlockedDays(nextUnlockedDays);
    setPendingCompletedDays([]);
    setActiveCompletedDay(null);
    setIsCompletionDialogOpen(false);

    const completedDays = new Set<number>();
    Array.from(schedule.entries()).forEach(([day, dayDestinations]) => {
      if (dayDestinations.length === 0) return;
      const finished = dayDestinations.every((destination, index) =>
        nextFinishedKeys.has(getEntryKey(destination, day, index))
      );
      if (finished) completedDays.add(day);
    });
    prevCompletedDaysRef.current = completedDays;
    lastHydratedSavedItineraryRef.current = savedItineraryId;
  }, [isSavedItinerary, itineraryEntryKeys, savedItineraryId, savedProgress, schedule]);

  useEffect(() => {
    const completedDays = new Set<number>();
    Array.from(schedule.entries()).forEach(([day]) => {
      if (isDayFinished(day)) {
        completedDays.add(day);
      }
    });

    const previousCompletedDays = prevCompletedDaysRef.current;
    const newlyCompletedDays = Array.from(completedDays).filter((day) => !previousCompletedDays.has(day));
    if (newlyCompletedDays.length > 0) {
      setPendingCompletedDays((prev) => {
        const existing = new Set(prev);
        if (activeCompletedDay !== null) {
          existing.add(activeCompletedDay);
        }
        const next = [...prev];
        newlyCompletedDays.forEach((day) => {
          if (!existing.has(day)) {
            next.push(day);
            existing.add(day);
          }
        });
        return next;
      });
    }

    prevCompletedDaysRef.current = completedDays;
  }, [activeCompletedDay, finishedDestinationKeys, schedule]);

  useEffect(() => {
    if (!isSavedItinerary) return;
    if (isCompletionDialogOpen) return;
    if (activeCompletedDay !== null) return;
    if (pendingCompletedDays.length === 0) return;

    setActiveCompletedDay(pendingCompletedDays[0]);
    setIsCompletionDialogOpen(true);
  }, [activeCompletedDay, isCompletionDialogOpen, isSavedItinerary, pendingCompletedDays]);

  useEffect(() => {
    if (isSavedItinerary) return;
    setIsCompletionDialogOpen(false);
    setActiveCompletedDay(null);
    setPendingCompletedDays([]);
    setRatingUnlockedDays(new Set());
    lastHydratedSavedItineraryRef.current = null;
  }, [isSavedItinerary]);

  useEffect(() => {
    if (!isSavedItinerary || !onSavedProgressChange) return;
    onSavedProgressChange({
      finishedEntryKeys: Array.from(finishedDestinationKeys),
      ratingUnlockedDays: Array.from(ratingUnlockedDays).sort((a, b) => a - b),
    });
  }, [finishedDestinationKeys, isSavedItinerary, onSavedProgressChange, ratingUnlockedDays]);

  const toggleFinished = (entryKey: string) => {
    setFinishedDestinationKeys((prev) => {
      const next = new Set(prev);
      if (next.has(entryKey)) {
        next.delete(entryKey);
      } else {
        next.add(entryKey);
      }
      return next;
    });
  };

  const handleRemoveClick = (destinationId: string, entryKey: string) => {
    setFinishedDestinationKeys((prev) => {
      if (!prev.has(entryKey)) return prev;
      const next = new Set(prev);
      next.delete(entryKey);
      return next;
    });
    onRemoveDestination(destinationId);
  };

  const openSaveDialog = () => {
    const defaultName = `Bulusan Trip ${new Date().toLocaleDateString()}`;
    setSaveNameDraft(defaultName);
    setSaveError(null);
    setIsSaveDialogOpen(true);
  };

  const handleSave = async () => {
    if (saveRequestInFlight.current) return;
    const itineraryName = saveNameDraft.trim();
    if (!itineraryName) {
      setSaveError('Please enter an itinerary name.');
      return;
    }

    saveRequestInFlight.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      const normalizedStops = [...stops]
        .filter((stop) => stop.destinationId && stop.startTime && stop.endTime)
        .sort((a, b) => {
          if (a.day !== b.day) return a.day - b.day;
          return a.sequence - b.sequence;
        });
      const newItinerary = {
        id: `itinerary_${Date.now()}`,
        name: itineraryName,
        destinations,
        stops: normalizedStops,
        tripDays,
        selectedDates: effectiveSelectedDates,
        createdAt: new Date().toISOString(),
        totalCost,
        totalDuration
      } as SavedItinerary;

      const created = await createItinerary(newItinerary);
      if (!created) {
        setSaveError('Please sign in to save itineraries.');
        return;
      }

      setSaveSuccess(true);
      setIsSaveDialogOpen(false);
      onSaveSuccess?.(created);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? '');
      if (message.includes('(401)') || message.includes('(403)')) {
        setSaveError('Your session expired. Please sign in again to save itineraries.');
      } else if (message.includes('(400)') || message.includes('(422)')) {
        setSaveError('Unable to save this itinerary due to invalid trip data. Please adjust destinations and try again.');
      } else if (message.includes('(404)')) {
        setSaveError('We could not save your itinerary right now. Please try again in a moment.');
      } else if (message.includes('(500)') || message.includes('(502)') || message.includes('(503)')) {
        setSaveError('Server error while saving itinerary. Please try again in a moment.');
      } else if (message.toLowerCase().includes('failed to fetch')) {
        setSaveError('Cannot reach the server right now. Check your network and try again.');
      } else {
        setSaveError(
          toUserFacingErrorMessage(error, {
            action: 'save your itinerary',
            fallback: 'Failed to save itinerary. Please try again.',
          })
        );
      }
    } finally {
      setIsSaving(false);
      saveRequestInFlight.current = false;
    }
  };

  const handleDownload = async () => {
    try {
      const formatPdfMoney = (value: number) =>
        `PHP ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.create();
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const marginX = 42;
      const topMargin = 52;
      const bottomMargin = 56;
      const contentWidth = pageWidth - marginX * 2;
      const imageCache = new Map<string, PDFImage | null>();
      const footerColor = rgb(0.46, 0.53, 0.62);

      const wrapText = (text: string, maxWidth: number, fontSize: number, bold = false): string[] => {
        const source = text.trim();
        if (!source) return [];
        const words = source.split(/\s+/);
        const font = bold ? fontBold : fontRegular;
        const lines: string[] = [];
        let current = '';
        words.forEach((word) => {
          const candidate = current ? `${current} ${word}` : word;
          if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
            current = candidate;
            return;
          }
          if (current) lines.push(current);
          current = word;
        });
        if (current) lines.push(current);
        return lines;
      };

      const loadImage = async (url?: string): Promise<PDFImage | null> => {
        if (!url) return null;
        if (imageCache.has(url)) return imageCache.get(url) ?? null;
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
          const bytes = await response.arrayBuffer();
          let image: PDFImage;
          try {
            image = await pdfDoc.embedJpg(bytes);
          } catch {
            image = await pdfDoc.embedPng(bytes);
          }
          imageCache.set(url, image);
          return image;
        } catch {
          imageCache.set(url, null);
          return null;
        }
      };

      await Promise.all(
        Array.from(new Set(destinations.map((destination) => destination.image).filter(Boolean))).map((url) =>
          loadImage(url)
        )
      );

      const drawFooter = (pageNumber: number, totalPages: number) => {
        const page = pdfDoc.getPages()[pageNumber - 1];
        page.drawLine({
          start: { x: marginX, y: 36 },
          end: { x: pageWidth - marginX, y: 36 },
          thickness: 0.6,
          color: rgb(0.84, 0.88, 0.93),
        });
        page.drawText(`Page ${pageNumber} of ${totalPages}`, {
          x: pageWidth - marginX - 72,
          y: 22,
          size: 9,
          color: footerColor,
          font: fontRegular,
        });
      };

      const coverPage = pdfDoc.addPage([pageWidth, pageHeight]);
      coverPage.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(0.97, 0.98, 1) });
      coverPage.drawRectangle({ x: 0, y: pageHeight - 238, width: pageWidth, height: 238, color: rgb(0.13, 0.34, 0.63) });
      coverPage.drawText('Bulusan Travel Itinerary', {
        x: marginX,
        y: pageHeight - 112,
        size: 33,
        font: fontBold,
        color: rgb(1, 1, 1),
      });
      const generatedAt = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
      });
      coverPage.drawText(`Generated ${generatedAt}`, {
        x: marginX,
        y: pageHeight - 142,
        size: 11,
        font: fontRegular,
        color: rgb(0.87, 0.93, 1),
      });

      const coverCards = [
        { label: 'Trip Days', value: `${tripDays}` },
        { label: 'Destinations', value: `${destinations.length}` },
        { label: 'Estimated Cost', value: formatPdfMoney(totalCost) },
      ];
      const cardGap = 14;
      const cardWidth = (contentWidth - cardGap * 2) / 3;
      const cardsTopY = pageHeight - 332;
      coverCards.forEach((card, index) => {
        const x = marginX + index * (cardWidth + cardGap);
        coverPage.drawRectangle({
          x,
          y: cardsTopY - 78,
          width: cardWidth,
          height: 78,
          borderWidth: 1,
          borderColor: rgb(0.76, 0.84, 0.92),
          color: rgb(1, 1, 1),
        });
        coverPage.drawText(card.label, {
          x: x + 12,
          y: cardsTopY - 28,
          size: 10,
          font: fontRegular,
          color: rgb(0.4, 0.46, 0.54),
        });
        coverPage.drawText(card.value, {
          x: x + 12,
          y: cardsTopY - 52,
          size: 15,
          font: fontBold,
          color: rgb(0.11, 0.17, 0.27),
        });
      });

      const coverImageTopY = pageHeight - 432;
      const coverImageHeight = 220;
      const coverDestinations = destinations.slice(0, 3);
      if (coverDestinations.length > 0) {
        const coverImageWidth = (contentWidth - cardGap * Math.max(coverDestinations.length - 1, 0)) / coverDestinations.length;
        for (let index = 0; index < coverDestinations.length; index += 1) {
          const destination = coverDestinations[index];
          const x = marginX + index * (coverImageWidth + cardGap);
          coverPage.drawRectangle({
            x,
            y: coverImageTopY - coverImageHeight,
            width: coverImageWidth,
            height: coverImageHeight,
            color: rgb(0.91, 0.95, 0.99),
            borderWidth: 1,
            borderColor: rgb(0.76, 0.84, 0.92),
          });
          const image = await loadImage(destination.image);
          if (image) {
            const scale = Math.min(coverImageWidth / image.width, coverImageHeight / image.height);
            const drawWidth = image.width * scale;
            const drawHeight = image.height * scale;
            coverPage.drawImage(image, {
              x: x + (coverImageWidth - drawWidth) / 2,
              y: coverImageTopY - coverImageHeight + (coverImageHeight - drawHeight) / 2,
              width: drawWidth,
              height: drawHeight,
            });
          } else {
            coverPage.drawText(destination.name.slice(0, 1).toUpperCase(), {
              x: x + coverImageWidth / 2 - 6,
              y: coverImageTopY - coverImageHeight / 2 - 6,
              size: 24,
              font: fontBold,
              color: rgb(0.43, 0.5, 0.62),
            });
          }
          const nameLines = wrapText(destination.name, coverImageWidth - 16, 10, true).slice(0, 2);
          nameLines.forEach((line, lineIndex) => {
            coverPage.drawText(line, {
              x: x + 8,
              y: coverImageTopY - coverImageHeight - 18 - lineIndex * 12,
              size: 10,
              font: fontBold,
              color: rgb(0.18, 0.25, 0.35),
            });
          });
        }
      }

      let page = pdfDoc.addPage([pageWidth, pageHeight]);
      let cursorY = pageHeight - topMargin;
      const ensureSpace = (height: number) => {
        if (cursorY - height < bottomMargin) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          cursorY = pageHeight - topMargin;
        }
      };
      const drawHeading = (title: string, subtitle?: string) => {
        page.drawText(title, {
          x: marginX,
          y: cursorY,
          size: 18,
          font: fontBold,
          color: rgb(0.08, 0.15, 0.25),
        });
        cursorY -= 24;
        if (subtitle) {
          page.drawText(subtitle, {
            x: marginX,
            y: cursorY,
            size: 10,
            font: fontRegular,
            color: rgb(0.42, 0.48, 0.56),
          });
          cursorY -= 18;
        }
      };

      drawHeading('Daily Itinerary', `${destinations.length} destinations across ${tripDays} day${tripDays === 1 ? '' : 's'}`);
      ensureSpace(82);

      const summaryCards = [
        { label: 'Trip Days', value: `${tripDays}` },
        { label: 'Total Cost', value: formatPdfMoney(totalCost) },
        { label: 'Activity Hours', value: `${formatHours(totalDuration)}h` },
      ];
      const summaryGap = 12;
      const summaryWidth = (contentWidth - summaryGap * 2) / 3;
      const summaryTop = cursorY;
      summaryCards.forEach((card, index) => {
        const x = marginX + index * (summaryWidth + summaryGap);
        page.drawRectangle({
          x,
          y: summaryTop - 64,
          width: summaryWidth,
          height: 64,
          borderWidth: 1,
          borderColor: rgb(0.86, 0.9, 0.95),
          color: rgb(0.99, 0.99, 1),
        });
        page.drawText(card.label, {
          x: x + 10,
          y: summaryTop - 24,
          size: 9,
          font: fontRegular,
          color: rgb(0.42, 0.48, 0.56),
        });
        page.drawText(card.value, {
          x: x + 10,
          y: summaryTop - 46,
          size: 12,
          font: fontBold,
          color: rgb(0.12, 0.18, 0.28),
        });
      });
      cursorY -= 86;

      schedule.forEach((dayDestinations, day) => {
        ensureSpace(46);
        page.drawRectangle({
          x: marginX,
          y: cursorY - 28,
          width: contentWidth,
          height: 28,
          color: rgb(0.94, 0.96, 0.99),
          borderWidth: 1,
          borderColor: rgb(0.86, 0.9, 0.95),
        });
        page.drawText(`Day ${day}`, {
          x: marginX + 10,
          y: cursorY - 18,
          size: 12,
          font: fontBold,
          color: rgb(0.12, 0.18, 0.28),
        });
        page.drawText(`${dayDestinations.length} ${dayDestinations.length === 1 ? 'stop' : 'stops'}`, {
          x: marginX + 72,
          y: cursorY - 18,
          size: 9,
          font: fontRegular,
          color: rgb(0.42, 0.48, 0.56),
        });
        cursorY -= 38;

        if (dayDestinations.length === 0) {
          ensureSpace(24);
          page.drawText('No activities scheduled for this day.', {
            x: marginX + 8,
            y: cursorY - 12,
            size: 10,
            font: fontRegular,
            color: rgb(0.46, 0.52, 0.61),
          });
          cursorY -= 28;
          return;
        }

        dayDestinations.forEach((destination, stopIndex) => {
          const durationHours = getDestinationDurationHours(destination);
          const details = [formatPdfMoney(destination.estimatedCost)];
          if (durationHours !== null) details.push(`${formatHours(durationHours)}h`);
          const address =
            destination.address?.fullAddress ||
            [destination.address?.barangay, destination.address?.city, destination.address?.province].filter(Boolean).join(', ');
          const thumbWidth = 84;
          const thumbHeight = 62;
          const textStartX = marginX + 12 + thumbWidth + 12;
          const textMaxWidth = contentWidth - (textStartX - marginX) - 16;
          const titleLines = wrapText(`${stopIndex + 1}. ${destination.name}`, textMaxWidth, 11, true);
          const addressLines = address ? wrapText(address, textMaxWidth, 9, false).slice(0, 2) : [];
          const bodyLineCount = titleLines.length + (addressLines.length > 0 ? addressLines.length : 0) + 1;
          const itemHeight = Math.max(78, 18 + bodyLineCount * 12);

          ensureSpace(itemHeight + 10);
          const itemTopY = cursorY;
          page.drawRectangle({
            x: marginX + 4,
            y: itemTopY - itemHeight,
            width: contentWidth - 8,
            height: itemHeight,
            borderWidth: 1,
            borderColor: rgb(0.9, 0.92, 0.96),
            color: rgb(1, 1, 1),
          });

          page.drawRectangle({
            x: marginX + 12,
            y: itemTopY - 8 - thumbHeight,
            width: thumbWidth,
            height: thumbHeight,
            color: rgb(0.93, 0.96, 0.99),
            borderWidth: 1,
            borderColor: rgb(0.83, 0.88, 0.94),
          });
          const image = imageCache.get(destination.image) ?? null;
          if (image) {
            const scale = Math.min(thumbWidth / image.width, thumbHeight / image.height);
            const drawWidth = image.width * scale;
            const drawHeight = image.height * scale;
            page.drawImage(image, {
              x: marginX + 12 + (thumbWidth - drawWidth) / 2,
              y: itemTopY - 8 - thumbHeight + (thumbHeight - drawHeight) / 2,
              width: drawWidth,
              height: drawHeight,
            });
          }

          let textY = itemTopY - 20;
          titleLines.forEach((line) => {
            page.drawText(line, {
              x: textStartX,
              y: textY,
              size: 11,
              font: fontBold,
              color: rgb(0.11, 0.17, 0.27),
            });
            textY -= 12;
          });
          page.drawText(details.join(' | '), {
            x: textStartX,
            y: textY - 2,
            size: 9,
            font: fontRegular,
            color: rgb(0.38, 0.45, 0.54),
          });
          textY -= 14;
          addressLines.forEach((line) => {
            page.drawText(line, {
              x: textStartX,
              y: textY,
              size: 9,
              font: fontRegular,
              color: rgb(0.45, 0.5, 0.59),
            });
            textY -= 11;
          });

          cursorY -= itemHeight + 10;
        });
      });

      const pages = pdfDoc.getPages();
      pages.forEach((_, index) => {
        drawFooter(index + 1, pages.length);
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bulusan-itinerary.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate itinerary PDF:', error);
      window.alert('Could not generate the PDF right now. Please try again.');
    }
  };

  const formatDescriptionLines = (description: string): string[] => {
    return description
      .replace(/\r\n?/g, '\n')
      .replace(/\s*[•●◦▪]\s*/g, '\n• ')
      .replace(/\s*\|\s*/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  };

  if (destinations.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-gray-600">Your itinerary is empty. Add destinations to get started!</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="p-6 transition-all duration-300 ease-out hover:shadow-lg">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Your Bulusan Itinerary</h2>
              <p className="text-gray-600 mt-1">{destinations.length} destinations planned</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md"
                onClick={handleDownload}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </div>

          <Separator />

          {emptyDays > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              We couldn’t fill {emptyDays} {emptyDays === 1 ? 'day' : 'days'} with activities. Add more destinations
              or adjust your preferences to see a fuller schedule.
            </div>
          )}

          {showBudgetSummary && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <p className="font-semibold">
                {isKnapsack ? 'Optimized by Knapsack' : 'Budget Optimization Applied'}
              </p>
              <p className="mt-1">
                Used {formatPeso(totalSelectedCost)} of {formatPeso(maxBudget as number)}
                {Number.isFinite(remainingBudget) ? ` (${formatPeso(remainingBudget as number)} remaining)` : ''}.
                {Number.isFinite(utilizationPct) ? ` Utilization: ${(utilizationPct as number).toFixed(1)}%.` : ''}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Calendar className="w-6 h-6 mx-auto mb-2 text-blue-600" />
              <div className="text-2xl font-semibold">{tripDays}</div>
              <div className="text-sm text-gray-600">Days</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <Wallet className="w-6 h-6 mx-auto mb-2 text-purple-600" />
              <div className="text-2xl font-semibold">{formatPeso(totalCost)}</div>
              <div className="text-sm text-gray-600">Est. Cost</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Day by Day Schedule */}
      {Array.from(schedule.entries()).map(([day, dayDestinations]) => (
        <Card key={day} className="p-6 transition-all duration-300 ease-out hover:shadow-lg">
          {(() => {
            const dayRouteUrl = buildGoogleMapsRouteUrl(dayDestinations, { origin: userLocation });
            const daySegments = getDaySegmentDistances(dayDestinations);
            const dayTimeline = buildDayTimeline(dayDestinations, { day, stops });
            return (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center font-semibold">
                  {day}
                </div>
                  <div>
                    <h3 className="font-semibold text-lg">Day {day}</h3>
                    {getDayDateLabel(day) && (
                      <p className="text-sm text-slate-600">{getDayDateLabel(day)}</p>
                    )}
                  </div>
                </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-sm"
                  onClick={() => setExpandedAddDay((current) => (current === day ? null : day))}
                >
                  Add More Destinations
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!dayRouteUrl}
                  className="transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-sm disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  onClick={() => {
                    if (!dayRouteUrl) return;
                    window.open(dayRouteUrl, '_blank', 'noopener,noreferrer');
                  }}
                >
                  <MapIcon className="mr-2 h-4 w-4" />
                  View Day on Map
                </Button>
              </div>
            </div>
            {expandedAddDay === day && (
              <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/70 p-4">
                <p className="text-sm font-medium text-slate-800">Choose destinations for Day {day}</p>
                {availableDestinations.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">All destinations are already in your itinerary.</p>
                ) : (
                  <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {availableDestinations.map((destination) => (
                      <div
                        key={`${day}-destination-${destination.id}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-white bg-white px-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{destination.name}</p>
                          <p className="text-xs text-slate-600">{formatPeso(destination.estimatedCost)}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setExpandedAddDay(null);
                            onAddDestination({ ...destination, plannedDay: day });
                          }}
                        >
                          Add to Day {day}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {daySegments.length > 0 && (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Between destinations</p>
                <div className="mt-1 space-y-1">
                  {daySegments.map((segment, segmentIndex) => (
                    <p key={`${day}-${segment.fromName}-${segment.toName}-${segmentIndex}`} className="text-xs text-slate-700">
                      {segment.fromName} → {segment.toName}: <span className="font-medium">{segment.distanceLabel}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3 sm:ml-6 sm:pl-6">
              {dayDestinations.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  No activities scheduled for this day yet.
                </div>
              )}
              {dayDestinations.map((dest, index) => (
                <div key={dest.id ?? `${dest.name}-${day}-${index}`} className="relative">
                  {(() => {
                    const entryKey = getEntryKey(dest, day, index);
                    const isFinished = finishedDestinationKeys.has(entryKey);
                    return (
                      <>
                        <div
                          className={`hidden sm:block absolute -left-8 w-4 h-4 rounded-full transition-all duration-300 ${
                            isFinished
                              ? 'bottom-0 bg-white border-2 border-blue-500'
                              : 'top-0 bg-white border-2 border-blue-500'
                          }`}
                        />
                        <div
                          className="hidden sm:block absolute left-[-1.5rem] -translate-x-1/2 top-0 h-full w-[2px] bg-gray-200"
                        />
                      </>
                    );
                  })()}
                  {(() => {
                    const durationHours = getDestinationDurationHours(dest);
                    const subInterestLabels = formatInterestList(dest.subInterests);
                    const showRating =
                      Boolean(onRateDestination) &&
                      isSavedItinerary &&
                      ratingUnlockedDays.has(day) &&
                      isDayFinished(day);
                    return (
                      <ItineraryDestinationCard
                        destination={dest}
                        timeLabel={dayTimeline[index]?.timeRangeLabel ?? null}
                        transferLabel={dayTimeline[index]?.transferLabel ?? null}
                        priceLabel={formatPeso(dest.estimatedCost)}
                        durationLabel={durationHours !== null ? `${formatHours(durationHours)}h` : 'N/A'}
                        tags={subInterestLabels}
                        origin={userLocation}
                        isFinished={finishedDestinationKeys.has(getEntryKey(dest, day, index))}
                        onFinish={() => toggleFinished(getEntryKey(dest, day, index))}
                        showFinishButton={isSavedItinerary}
                        showActionsMenu={isSavedItinerary}
                        onEdit={() => setSelectedDestination(dest)}
                        onDelete={() => handleRemoveClick(dest.id, getEntryKey(dest, day, index))}
                        footerContent={showRating ? (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-slate-600">Your rating</p>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: 5 }, (_, starIndex) => {
                                const value = starIndex + 1;
                                const active = value <= (destinationRatings?.[dest.id] ?? 0);
                                return (
                                  <button
                                    key={`${dest.id}-itn-rate-${value}`}
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onRateDestination?.(dest, value);
                                    }}
                                    className="rounded-sm p-0.5 transition hover:scale-110"
                                    aria-label={`Rate ${dest.name} ${value} star${value > 1 ? 's' : ''}`}
                                    title={`Rate ${value} star${value > 1 ? 's' : ''}`}
                                  >
                                    <Star className={`h-4 w-4 ${active ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                                  </button>
                                );
                              })}
                              <span className="ml-1 text-xs text-slate-500">
                                {destinationRatings?.[dest.id] ? `${destinationRatings[dest.id]}/5` : 'Not rated'}
                              </span>
                            </div>
                          </div>
                        ) : null}
                      />
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
            );
          })()}
        </Card>
      ))}

      {/* Actions */}
      <Card className="p-6 transition-all duration-300 ease-out hover:shadow-lg">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="font-semibold">Ready to explore Bulusan?</h4>
            <p className="text-sm text-gray-600 mt-1">
              Save your itinerary or start planning a new trip
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onViewSavedItineraries && (
              <Button
                variant="outline"
                className="transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md"
                onClick={onViewSavedItineraries}
              >
                View My Itineraries
              </Button>
            )}
            <Button
              variant="outline"
              onClick={openSaveDialog}
              disabled={isSaving}
              className={`transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md ${isSaving ? 'cursor-not-allowed' : ''}`}
            >
              {isSaving ? 'Saving...' : 'Save Itinerary'}
            </Button>
            <Button
              variant="outline"
              className="transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md"
              onClick={onReset}
            >
              Start New Itinerary
            </Button>
          </div>
        </div>
      </Card>

      <Dialog
        open={isSaveDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!isSaving) {
            setIsSaveDialogOpen(nextOpen);
          }
        }}
      >
        <DialogContent className="sm:max-w-md p-5">
          <DialogHeader>
            <DialogTitle>Save Itinerary</DialogTitle>
            <DialogDescription>
              Enter a name for this itinerary.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={saveNameDraft}
              onChange={(e) => setSaveNameDraft(e.target.value)}
              placeholder="Itinerary name"
              className="h-10 text-sm"
              autoFocus
              disabled={isSaving}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSave();
                }
              }}
            />
            {saveError && (
              <p className="text-sm text-red-600">{saveError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSaveDialogOpen(false)}
              size="sm"
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} size="sm" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={saveSuccess}
        onOpenChange={(nextOpen) => {
          setSaveSuccess(nextOpen);
        }}
      >
        <DialogContent className="sm:max-w-md p-5">
          <DialogHeader>
            <DialogTitle>Itinerary Saved</DialogTitle>
            <DialogDescription>
              Your generated itinerary has been saved successfully.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setSaveSuccess(false)}
              size="sm"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCompletionDialogOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setIsCompletionDialogOpen(true);
            return;
          }
          if (activeCompletedDay !== null) {
            setRatingUnlockedDays((prev) => new Set(prev).add(activeCompletedDay));
          }
          setPendingCompletedDays((prev) => prev.slice(1));
          setActiveCompletedDay(null);
          setIsCompletionDialogOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md p-5">
          <DialogHeader>
            <DialogTitle>
              Day {activeCompletedDay ?? ''} Completed
              {activeCompletedDay !== null && getDayDateLabel(activeCompletedDay)
                ? ` (${getDayDateLabel(activeCompletedDay)})`
                : ''}
            </DialogTitle>
            <DialogDescription>
              Great job! You have finished all destinations for Day {activeCompletedDay ?? ''}.
              Please rate your experience for each destination below.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                if (activeCompletedDay !== null) {
                  setRatingUnlockedDays((prev) => new Set(prev).add(activeCompletedDay));
                }
                setPendingCompletedDays((prev) => prev.slice(1));
                setActiveCompletedDay(null);
                setIsCompletionDialogOpen(false);
              }}
              size="sm"
            >
              Rate Day {activeCompletedDay ?? ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedDestination !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedDestination(null);
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:max-h-[90vh] sm:max-w-2xl sm:p-6">
          {selectedDestination && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedDestination.name}</DialogTitle>
                <DialogDescription>
                  Destination details from your itinerary.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <DestinationImageGallery destination={selectedDestination} />
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1 text-sm text-gray-700">
                  {formatDescriptionLines(selectedDestination.description).map((line, index) => (
                    <p key={`${selectedDestination.id}-desc-${index}`} className="leading-relaxed">
                      {line}
                    </p>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                  <span className="inline-flex items-center gap-1">
                    <Wallet className="w-4 h-4" />
                    {formatPeso(selectedDestination.estimatedCost)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="w-4 h-4" />
                    {getDestinationDurationHours(selectedDestination) !== null
                      ? `Average Visit Time: ${formatHours(getDestinationDurationHours(selectedDestination) as number)}h`
                      : 'Average Visit Time: N/A'}
                  </span>
                </div>
                <TravelModeBadges destination={selectedDestination} origin={userLocation} />
                <DestinationLocationPanel destination={selectedDestination} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
