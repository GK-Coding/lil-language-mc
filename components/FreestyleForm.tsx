'use client'

import { useState, useEffect, KeyboardEvent } from 'react';
import Word from './Word';

export default function FreestyleForm({word}: {word: string}) {
    const [lines, setLines] = useState<string[]>(['']);

    const updateLines = (index: number, newValue: string) => {
        const newLines = [...lines];
        newLines[index] = newValue;
        setLines(newLines);
    }

    const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (index === lines.length - 1 && index < 3) {
                setLines([...lines, '']);
            }
        }
    }

    return (
        <div className="max-w-[1920px] w-full px-[100px] pb-[100px] pt-[25px] mx-auto">
            <Word word={word} linesComplete={lines.length - 1} />
            {lines.map((line, index) => (
                <input 
                    key={index} 
                    type="text" 
                    onChange={(e) => updateLines(index, e.target.value)} 
                    onKeyPress={(e) => handleKeyPress(e, index)} 
                    value={line} 
                    className="w-full text-2xl py-[20px] mb-[25px] px-[40px] dark:text-[#E1E3E3] rounded-[25px] bg-transparent border-solid border border-[#1C1E1E]/50 dark:border-[#E1E3E3]/50"
                />
            ))}
        </div>
    )
}