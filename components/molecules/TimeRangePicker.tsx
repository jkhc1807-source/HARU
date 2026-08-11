"use client";

import { ChoiceSelect } from "../atoms/ChoiceSelect";
import type { ChoiceOption } from "../atoms/ChoiceSelect";

export function TimeRangePicker({ startTime, endTime, options, isInvalid, onStartChange, onEndChange }: {
  startTime: string;
  endTime: string;
  options: ChoiceOption[];
  isInvalid: boolean;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  const startOptions = options.filter(option => option.value !== "24:00");
  const startMinutes = toMinutes(startTime);
  const endOptions = options.filter(option => toMinutes(option.value) > startMinutes);

  return <div className={`time-range ${isInvalid ? "invalid" : ""}`}>
    <div className="time-select-field">
      <span className="time-select-label">시작</span>
      <ChoiceSelect value={startTime} placeholder="시간 선택" ariaLabel="시작 시간" options={startOptions} onChange={onStartChange} />
    </div>
    <span className="time-arrow" aria-hidden="true">→</span>
    <div className="time-select-field">
      <span className="time-select-label">종료</span>
      <ChoiceSelect disabled={!startTime} value={endTime} placeholder={startTime ? "시간 선택" : "시작 먼저 선택"} ariaLabel="종료 시간" options={endOptions} onChange={onEndChange} />
    </div>
  </div>;
}

function toMinutes(value: string) {
  const [hour = 0, minute = 0] = value.split(":").map(Number);
  return hour * 60 + minute;
}
