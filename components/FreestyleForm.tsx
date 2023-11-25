'use client'

import { useState, useEffect, KeyboardEvent, useRef } from 'react';
import Word from './Word';

export default function FreestyleForm({word}: {word: string}) {
    const [pageState, setPageState] = useState<'intro' | 'rapping' | 'score'>('rapping');

    const [lines, setLines] = useState<string[]>(['']);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const [score, setScore] = useState<number>(0);

    useEffect(() => {
        // Focus the last input element when lines are updated
        const lastInputIndex = lines.length - 1;
        if (inputRefs.current[lastInputIndex]) {
            inputRefs.current[lastInputIndex]!.focus();
        }
    }, [lines]); // Depend on lines

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
            } else if (index === 3) {
                submit();
            }
        }
    }

    const assessScore = async  () => {
        return 10
    }

    const submit = () => {
        assessScore().then(score => {
            setScore(score);
            setPageState("score");
        });
    }

    if (pageState === "rapping") {
        return (
            <div className="max-w-[1920px] w-full px-[100px] pb-[100px] pt-[25px] mx-auto">
                <Word word={word} linesComplete={lines.length - 1} submit={submit} />
                {lines.map((line, index) => (
                    <input 
                        key={index} 
                        ref={el => {
                            if (el) inputRefs.current[index] = el;
                        }}
                        type="text" 
                        onChange={(e) => updateLines(index, e.target.value)} 
                        onKeyPress={(e) => handleKeyPress(e, index)} 
                        value={line} 
                        className="w-full text-2xl py-[20px] mb-[25px] px-[40px] dark:text-[#E1E3E3] rounded-[25px] bg-transparent border-solid border border-[#1C1E1E]/50 dark:border-[#E1E3E3]/50"
                    />
                ))}
            </div>
        )
    } else if (pageState === "score") {
        return (
            <div className="max-w-[1920px] w-full px-[100px] pb-[100px] pt-[25px] mx-auto text-center">
                <h1>Your Total Score Was</h1>
                <h1 className='text-[211px] leading-none font-bold tracking-[0.06em] pt-[20px]'>{score}/100</h1>
                
                {lines.map((line, index) => (
                    <input 
                        key={index} 
                        ref={el => {
                            if (el) inputRefs.current[index] = el;
                        }}
                        type="text" 
                        onChange={(e) => updateLines(index, e.target.value)} 
                        onKeyPress={(e) => handleKeyPress(e, index)} 
                        value={line} 
                        className="w-full text-2xl py-[20px] mb-[25px] px-[40px] dark:text-[#E1E3E3] rounded-[25px] bg-transparent border-solid border border-[#1C1E1E]/50 dark:border-[#E1E3E3]/50"
                        disabled={true}
                    />
                ))}
            </div>
        )
    }
}