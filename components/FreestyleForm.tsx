'use client'

import { useState, useEffect, KeyboardEvent, useRef } from 'react';
import Word from './Word';
import { assessScore } from './assessScore';
import { RZWord } from '@/app/server';
import { redirect, useRouter } from 'next/navigation';

export default function FreestyleForm({word}: {word: string}) {
    const router = useRouter();

    const [pageState, setPageState] = useState<'intro' | 'rapping' | 'score'>('rapping');

    const [lines, setLines] = useState<string[]>(['']);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const [matchedWordData, setMatchedWordData] = useState<RZWord[]>([]);
    const [score, setScore] = useState<number>(0);
    
    const reset = () => {
        router.replace("../../");
    };

    useEffect(() => {
        // Focus the last input element when lines are updated
        const lastInputIndex = lines.length - 1;
        if (inputRefs.current[lastInputIndex]) {
            inputRefs.current[lastInputIndex]!.focus();
        }
    }, [lines.length]); // Depend on lines

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
            } else if (index < lines.length) {
                if (lines[lines.length - 1] !== "" && lines.length < 4) {
                    setLines([...lines, '']);
                } else {
                    const lastInputIndex = lines.length - 1;
                    if (inputRefs.current[lastInputIndex]) {
                        inputRefs.current[lastInputIndex]!.focus();
                    }
                }
            }
        }
    }

    const submit = () => {
        assessScore(lines, word).then(matchedWords => {
            setMatchedWordData(matchedWordData);
            const sum = matchedWords.reduce(function (a, b) {
                return a + Math.min(100, b['score'])
            }, 0)
            setScore(sum / 4);
            setPageState("score");
        });
    }

    if (pageState === "rapping") {
        return (
            <div className="max-w-[1920px] w-full px-[100px] pb-[100px] pt-[25px] mx-auto">
                <Word word={word} linesComplete={lines.length - 1} submit={submit} />
                
                <div className='absolute bottom-[100px] px-[0px] h-[394px] w-full max-w-[1720px]'>
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
            </div>
        )
    } else if (pageState === "score") {
        return (
            <div className="max-w-[1920px] w-full px-[100px] pb-[100px] pt-[25px] mx-auto text-center">
                <h1>Your Total Score For &quot;{word}&quot; Was</h1>
                <h1 className='text-[211px] leading-none font-bold tracking-[0.06em] py-[20px]'>{score}/100</h1>

                <button className="bg-[#5CE2C7] px-[66px] py-[15px] mt-[8px] mb-[84px] rounded-[25px] text-black text-[30px] font-bold" onClick={() => reset()}>Play Again</button>
                
                <div className='absolute bottom-[100px] px-[0px] h-[394px] w-full max-w-[1720px]'>
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
            </div>
        )
    }
}