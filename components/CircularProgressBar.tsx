'use client';

import React, { useState, useEffect } from 'react';

const cleanPercentage = (progress: number) => {
    const isNegativeOrNaN = !Number.isFinite(+progress) || progress < 0; // we can set non-numbers to 0 here
    const isTooHigh = progress > 100;
    return isNegativeOrNaN ? 0 : isTooHigh ? 100 : +progress;
  };
  
  const Circle = ({ color, progress, bg, mobile }: { color: string, progress?: number, bg?: boolean, mobile: boolean }) => {
    const r = mobile ? 22.5 : 70;
    const circ = 2 * Math.PI * r;
    const strokePct = progress === undefined ? 0 : ((100 - progress) * circ) / 100; // where stroke will start, e.g. from 15% to 100%.
    return (
      <circle
        r={r}
        cx={mobile ? 25 : 100}
        cy={mobile ? 30 : 100}
        fill="transparent"
        stroke={!bg ? progress !== 0 ? (mobile ? "url(#linear)" : "url(#linear2)") : "" : color} // remove colour as 0% sets full circumference
        strokeWidth={mobile ? "6px" : "20px"}
        strokeDasharray={circ}
        strokeDashoffset={progress ? strokePct : 0}
        strokeLinecap="round"
      ></circle>
    );
  };
  
  const Text = ({ text, mobile }: { text: string, mobile: boolean }) => {
    return (
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize={mobile? "0.5em" : "1.5em"}
      >
        {text}
      </text>
    );
  };

export default function CircularProgressBar({ progress, text, gradient }: { progress: number, text: string, gradient: [string, string] }) {
  const [value, setValue] = useState(100);

  useEffect(() => {
    // Animate progress value change
    const timeout = setTimeout(() => {
      setValue(progress);
    }, 100);

    return () => clearTimeout(timeout);
  }, [progress]);

  return (
    <>
    <svg className="block md:hidden z-10" width={60} height={60}>
    <defs>
        <linearGradient id="linear" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={gradient[0]}/>
            <stop offset="100%" stopColor={gradient[1]}/>
        </linearGradient>
    </defs>
      <g transform={`rotate(-90 ${"27.5 27.5"})`}>
        <Circle color="#DDE0E3" bg={true} mobile={true} />
        <Circle color={"#2fd4e1"} progress={value} mobile={true} />
      </g>
      <Text text={text} mobile={true} />
    </svg>
    <svg className="hidden md:block" width={200} height={200}>
    <defs>
        <linearGradient id="linear2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={gradient[0]}/>
            <stop offset="100%" stopColor={gradient[1]}/>
        </linearGradient>
    </defs>
      <g transform={`rotate(-90 ${"100 100"})`}>
        <Circle color="#DDE0E3" bg={true} mobile={false} />
        <Circle color={"#2fd4e1"} progress={value} mobile={false} />
      </g>
      <Text text={text} mobile={false} />
    </svg>
    </>
  );
};