'use client';

import React, { useState, useEffect } from 'react';

const cleanPercentage = (progress: number) => {
    const isNegativeOrNaN = !Number.isFinite(+progress) || progress < 0; // we can set non-numbers to 0 here
    const isTooHigh = progress > 100;
    return isNegativeOrNaN ? 0 : isTooHigh ? 100 : +progress;
  };
  
  const Circle = ({ color, progress, bg }: { color: string, progress?: number, bg?: boolean }) => {
    const r = 70;
    const circ = 2 * Math.PI * r;
    const strokePct = progress === undefined ? 0 : ((100 - progress) * circ) / 100; // where stroke will start, e.g. from 15% to 100%.
    return (
      <circle
        r={r}
        cx={100}
        cy={100}
        fill="transparent"
        stroke={!bg ? progress !== 0 ? "url(#linear)" : "" : color} // remove colour as 0% sets full circumference
        strokeWidth={"20px"}
        strokeDasharray={circ}
        strokeDashoffset={progress ? strokePct : 0}
        strokeLinecap="round"
      ></circle>
    );
  };
  
  const Text = ({ text }: { text: string }) => {
    return (
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize={"1.5em"}
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
    <svg width={200} height={200}>
    <defs>
        <linearGradient id="linear" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={gradient[0]}/>
            <stop offset="100%" stopColor={gradient[1]}/>
        </linearGradient>
    </defs>
      <g transform={`rotate(-90 ${"100 100"})`}>
        <Circle color="#DDE0E3" bg={true} />
        <Circle color={"#2fd4e1"} progress={value} />
      </g>
      <Text text={text} />
    </svg>
  );
};