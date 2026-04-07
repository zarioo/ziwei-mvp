"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import classNames from "classnames";
import { getPalaceNames } from "iztro/lib/astro";
import { Izpalace } from "react-iztro/lib/Izpalace/Izpalace";
import { IzpalaceCenter } from "react-iztro/lib/IzpalaceCenter";
import "react-iztro/lib/Iztrolabe/Iztrolabe.css";
import "react-iztro/lib/theme/default.css";

type IztrolabeServerProps = {
  astrolabe: any;
  horoscope: any;
  horoscopeDate: Date;
  horoscopeHour: number;
  centerPalaceAlign?: boolean;
  onHoroscopeChange?: (date: Date, hour: number) => Promise<any>;
};

export default function IztrolabeServer({
  astrolabe,
  horoscope,
  horoscopeDate,
  horoscopeHour,
  centerPalaceAlign,
  onHoroscopeChange,
}: IztrolabeServerProps) {
  const [taichiPoint, setTaichiPoint] = useState(-1);
  const [taichiPalaces, setTaichiPalaces] = useState<string[] | undefined>();
  const [activeHeavenlyStem, setActiveHeavenlyStem] = useState<string>();
  const [hoverHeavenlyStem, setHoverHeavenlyStem] = useState<string>();
  const [focusedIndex, setFocusedIndex] = useState<number>();
  const [showDecadal, setShowDecadal] = useState(false);
  const [showYearly, setShowYearly] = useState(false);
  const [showMonthly, setShowMonthly] = useState(false);
  const [showDaily, setShowDaily] = useState(false);
  const [showHourly, setShowHourly] = useState(false);
  const [currentHoroscopeDate, setCurrentHoroscopeDate] =
    useState<Date>(horoscopeDate);
  const [currentHoroscopeHour, setCurrentHoroscopeHour] =
    useState<number>(horoscopeHour);
  const [currentHoroscope, setCurrentHoroscope] = useState<any>(horoscope);
  const currentHoroscopeDateRef = useRef<Date>(horoscopeDate);
  const currentHoroscopeHourRef = useRef<number>(horoscopeHour);
  const lastHoroscopeRequestRef = useRef<string | null>(null);

  useEffect(() => {
    // 当后端返回新的盘面数据时，同步到本地状态
    setCurrentHoroscope(horoscope);
    setCurrentHoroscopeDate(horoscopeDate);
    setCurrentHoroscopeHour(horoscopeHour);
    currentHoroscopeDateRef.current = horoscopeDate;
    currentHoroscopeHourRef.current = horoscopeHour;
  }, [horoscope, horoscopeDate, horoscopeHour]);

  const requestHoroscopeChange = (next: {
    date?: Date;
    hour?: number;
  }) => {
    const nextDate = next.date ?? currentHoroscopeDateRef.current;
    const nextHour = next.hour ?? currentHoroscopeHourRef.current;
    currentHoroscopeDateRef.current = nextDate;
    currentHoroscopeHourRef.current = nextHour;
    const requestKey = `${nextDate.toISOString()}|${nextHour}`;
    if (requestKey === lastHoroscopeRequestRef.current) {
      // 连续相同请求时直接忽略，避免“闪一下又回退”
      return;
    }
    lastHoroscopeRequestRef.current = requestKey;
    void updateHoroscope(nextDate, nextHour);
  };

  const updateHoroscope = async (date: Date, hour: number) => {
    if (!onHoroscopeChange) return;
    const next = await onHoroscopeChange(date, hour);
    setCurrentHoroscope(next);
    setCurrentHoroscopeDate(date);
    setCurrentHoroscopeHour(hour);
  };

  const toggleShowScope = (scope: string) => {
    switch (scope) {
      case "decadal":
        setShowDecadal(!showDecadal);
        break;
      case "yearly":
        setShowYearly(!showYearly);
        break;
      case "monthly":
        setShowMonthly(!showMonthly);
        break;
      case "daily":
        setShowDaily(!showDaily);
        break;
      case "hourly":
        setShowHourly(!showHourly);
        break;
    }
  };

  const toggleActiveStem = (heavenlyStem?: string) => {
    if (heavenlyStem === activeHeavenlyStem) {
      setActiveHeavenlyStem(undefined);
      return;
    }
    setActiveHeavenlyStem(heavenlyStem);
  };

  const dynamic = useMemo(() => {
    if (showHourly) {
      return {
        arrowIndex: currentHoroscope?.hourly?.index,
        arrowScope: "hourly",
      };
    }
    if (showDaily) {
      return {
        arrowIndex: currentHoroscope?.daily?.index,
        arrowScope: "daily",
      };
    }
    if (showMonthly) {
      return {
        arrowIndex: currentHoroscope?.monthly?.index,
        arrowScope: "monthly",
      };
    }
    if (showYearly) {
      return {
        arrowIndex: currentHoroscope?.yearly?.index,
        arrowScope: "yearly",
      };
    }
    if (showDecadal) {
      return {
        arrowIndex: currentHoroscope?.decadal?.index,
        arrowScope: "decadal",
      };
    }
    return undefined;
  }, [showDecadal, showYearly, showMonthly, showDaily, showHourly, currentHoroscope]);

  useEffect(() => {
    if (taichiPoint < 0) {
      setTaichiPalaces(undefined);
    } else {
      setTaichiPalaces(getPalaceNames(taichiPoint));
    }
  }, [taichiPoint]);

  const toggleTaichiPoint = (index: number) => {
    if (taichiPoint === index) {
      setTaichiPoint(-1);
      return;
    }
    setTaichiPoint(index);
  };

  return (
    <div className={classNames("iztro-astrolabe", "iztro-astrolabe-theme-default")}>
      {astrolabe?.palaces?.map((palace: any) => (
        <Izpalace
          key={palace.earthlyBranch}
          {...palace}
          focusedIndex={focusedIndex}
          onFocused={setFocusedIndex}
          horoscope={currentHoroscope}
          showDecadalScope={showDecadal}
          showYearlyScope={showYearly}
          showMonthlyScope={showMonthly}
          showDailyScope={showDaily}
          showHourlyScope={showHourly}
          taichiPalace={taichiPalaces?.[palace.index]}
          toggleScope={toggleShowScope}
          activeHeavenlyStem={activeHeavenlyStem}
          toggleActiveHeavenlyStem={toggleActiveStem}
          hoverHeavenlyStem={hoverHeavenlyStem}
          setHoverHeavenlyStem={setHoverHeavenlyStem}
          toggleTaichiPoint={toggleTaichiPoint}
        />
      ))}
      <IzpalaceCenter
        astrolabe={astrolabe}
        horoscope={currentHoroscope}
        horoscopeDate={currentHoroscopeDate}
        horoscopeHour={currentHoroscopeHour}
        setHoroscopeDate={(date: Date) => requestHoroscopeChange({ date })}
        setHoroscopeHour={(hour: number) => requestHoroscopeChange({ hour })}
        centerPalaceAlign={centerPalaceAlign}
        {...dynamic}
      />
    </div>
  );
}

