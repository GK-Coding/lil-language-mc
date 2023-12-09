'use client'

import { useState, useEffect, KeyboardEvent, useRef } from 'react';
import { RZWord } from '@/app/server';
import { redirect, useRouter } from 'next/navigation';
import { arraysEqual, getLastWord, getTimePercentageClass } from '@/util';
import { getRhymeData } from '@/util/rhymes';
import { getScore, perfectRhymeScore, nearRhymeScore, maybeRhymeScore, getSyllableMatch, getBonusPoints, getComplexity, getPenalty, getWordCountPenalty } from '@/util/score';
import { syllable } from 'syllable';
import { Difficulty } from '@/types/difficulty';

const calculateColor = (percentage: number) => {
    return (percentage > 75 ? "bg-[#5DE3C8]" : (percentage > 50 ? "bg-[#5DE36A]" : (percentage > 25 ? "bg-[#E0E35D]" : (percentage > 10 ? "bg-[#FF7B01]" : "bg-[#FF0101]"))));
}

export default function FreestyleForm({ word, difficulty }: { word: string, difficulty: Difficulty }) {
    const router = useRouter();

    const [countdownTimeLeft, setCountdownTimeLeft] = useState(3);
    const [countdownActive, setCountdownActive] = useState<boolean>(true);

    const [pageState, setPageState] = useState<'intro' | 'rapping' | 'score'>('intro');

    useEffect(() => {
        if (countdownActive) {
            countdownTimeLeft > 0 && setTimeout(() => setCountdownTimeLeft(countdownTimeLeft - 1), 1000);
            countdownTimeLeft == 1 && setTimeout(() => {
                setPageState('rapping');
                setCountdownActive(false);
            }, 1000)
        }
    }, [countdownTimeLeft, countdownActive]);

    const [timePercentageLeft, setTimePercentageLeft] = useState(100);
    const [timeLeft, setTimeLeft] = useState(40);

    useEffect(() => {
        timeLeft > 0 && setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
        timePercentageLeft > 0 && pageState === "rapping" && setTimeout(() => setTimePercentageLeft(timeLeft / 40 * 100), 1000)
        timeLeft < 1 && setTimeout(() => submit(), 1000)
    }, [timeLeft]);

    const [lines, setLines] = useState<string[]>(['']);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const [score, setScore] = useState<number>(0);

    const reset = () => {
        setPageState('intro');
        setCountdownTimeLeft(3);
        setCountdownActive(true);
        setTimeLeft(40);
        setTimePercentageLeft(100);
        router.refresh();
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
        getRhymeData(lines, word).then(result => {
            const { mappedLines, linePronunciations, targetWordPronunciation } = result;

            // SECTION Rhymes

            const phonemesToTarget = targetWordPronunciation.substring(
                targetWordPronunciation.lastIndexOf(' ',
                    targetWordPronunciation.lastIndexOf('1')
                )
            );

            const perfectRhymes = linePronunciations.map(linePronunciation => {
                return linePronunciation.endsWith(phonemesToTarget);
            }).reduce((acc, val) => acc + (val ? 1 : 0), 0);

            console.log(perfectRhymes);

            const nearRhymes = linePronunciations.map(linePronunciation => {
                const phonemesToCheck = linePronunciation.substring(linePronunciation.lastIndexOf(' ', linePronunciation.lastIndexOf('1')));
                const vowelPhonemesToCheck = phonemesToCheck.split(' ').filter(phoneme => phoneme.includes('1') || phoneme.includes('0') || phoneme.includes('2'));
                const vowelPhonemesToTarget = phonemesToTarget.split(' ').filter(phoneme => phoneme.includes('1') || phoneme.includes('0') || phoneme.includes('2'));
                return arraysEqual(vowelPhonemesToCheck, vowelPhonemesToTarget);
            }).reduce((acc, val) => acc + (val ? 1 : 0), 0) - perfectRhymes;

            console.log(nearRhymes);

            const maybeRhymes = Math.max((linePronunciations.map(linePronunciation => {
                const phonemesToCheck = linePronunciation.substring(linePronunciation.lastIndexOf(' ', linePronunciation.lastIndexOf('1')));
                return phonemesToCheck[0] == phonemesToTarget[0] && phonemesToCheck.length == phonemesToTarget.length;
            }).reduce((acc, val) => acc + (val ? 1 : 0), 0) - perfectRhymes - nearRhymes), 0);

            console.log(maybeRhymes);

            //!SECTION Rhymes

            const syllableMatch = getSyllableMatch(lines);

            const complexity = getComplexity(lines);

            const bonusPoints = getBonusPoints(timePercentageLeft, getLastWord(lines) === word);

            const penalty = getPenalty(timePercentageLeft, lines);

            const wordCountPenalty = getWordCountPenalty(lines);

            const score = getScore({
                rhymeQuality: perfectRhymes * perfectRhymeScore + nearRhymes * nearRhymeScore + maybeRhymes * maybeRhymeScore,
                syllableMatch,
                complexity,
                bonusPoints,
                penalty,
                wordCountPenalty
            });

            setScore(score);
            setPageState("score");
        });
    }

    if (pageState === "intro") {
        return (
            <div className="absolute top-[90px] left-0 right-0 flex justify-center items-center max-w-[1920px] px-[100px] mx-auto">
                <div className="flex-col justify-center items-center gap-10 flex">
                    <div className="flex-col justify-center items-center flex">
                        <div className="text-center">
                            <span className="text-[211px] font-bold tracking-[3.05px]">{countdownTimeLeft}</span>
                        </div>
                    </div>
                </div>
            </div>
        )
    } else if (pageState === "rapping") {
        return (
            <div className="max-w-[1920px] w-full px-[30px] md:px-[100px] pb-[100px] pt-[25px] mx-auto">
                <div className={"absolute left-0 top-0 h-8 w-full"}>
                <div className={`h-full transition-width ease-linear duration-[990ms] ` + calculateColor(timePercentageLeft)} style={{"width": timePercentageLeft + "%"}}></div>
                </div>
                <div className="flex flex-col w-auto pb-[220px] pt-[132px] mx-auto">
                    <div className="flex w-auto content-center items-center">
                        <h1 className='flex-1 text-center text-[211px] md:px-[100px] pt-[20px] hidden md:block max-h-[211px] leading-none font-bold tracking-[0.06em]'>
                            {word.toUpperCase()}
                        </h1>
                        <h1 className='flex-1 text-center text-[40px] md:px-[100px] pt-[5px] md:pt-[20px] h-[40px] leading-none font-bold tracking-[0.06em] md:hidden'>
                            {word.toUpperCase()}
                        </h1>
                    </div>
                    <div className="flex flex-col w-auto content-center items-center pt-[25px]">
                        <h2 className='flex-1 text-center text-[14px] md:text-[35px] md:px-[100px] pt-[20px] leading-none font-bold tracking-[0.06em]'>
                            Write 4 sentences that rhyme with the keyword
                        </h2>
                        <h3 className='flex-1 text-center text-[12px] md:text-[25px] md:px-[100px] pt-[20px] leading-none tracking-[0.06em]'>
                            4-Bar Mode | {difficulty[0].toUpperCase() + difficulty.slice(1)}
                        </h3>
                    </div>
                </div>

                <div className='absolute top-[140px] md:top-[auto] md:bottom-[100px] md:px-0 h-[394px] left-[30px] right-[30px] md:left-auto md:right-auto md:w-full max-w-[1720px]'>
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
                            enterKeyHint={index === 3 ? "go" : "next"}
                            className="w-full text-[14px] md:text-2xl py-[10px] md:py-[20px] mb-[25px] px-[15px] md:px-[40px] dark:text-[#E1E3E3] rounded-[12px] md:rounded-[25px] bg-transparent border-solid border border-[#1C1E1E]/50 dark:border-[#E1E3E3]/50"
                        />
                    ))}
                </div>
            </div>
        )
    } else if (pageState === "score") {
        return (
            <div className="max-w-[1920px] w-full px-[100px] pb-[100px] pt-[25px] mx-auto text-center">
                <h1 className='md:text-[61px]'>Your Total Score For &quot;{word}&quot; Was</h1>
                <h1 className='text-[40px] md:text-[211px] leading-none font-bold tracking-[0.06em] py-[20px]'>{score}/100</h1>

                <button className="bg-[#5CE2C7] px-[66px] py-[15px] mt-[8px] md:mb-[84px] rounded-[12px] md:rounded-[25px] text-black text-[18px] md:text-[30px] font-bold absolute bottom-[25px] left-[25px] right-[25px] md:static" onClick={() => reset()}>Play Again</button>

                <div className='absolute top-[180px] md:top-[auto] md:bottom-[100px] md:px-0 h-[394px] left-[30px] right-[30px] md:left-auto md:right-auto md:w-full max-w-[1720px]'>
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
                            className="w-full text-[14px] md:text-2xl py-[10px] md:py-[20px] mb-[25px] px-[15px] md:px-[40px] dark:text-[#E1E3E3] rounded-[12px] md:rounded-[25px] bg-transparent border-solid border border-[#1C1E1E]/50 dark:border-[#E1E3E3]/50"
                            disabled={true}
                        />
                    ))}
                </div>
            </div>
        )
    }
}