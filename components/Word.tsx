'use client'
 
import { useEffect, useState } from 'react'
import CircularProgressBar from './CircularProgressBar'
import { Textfit } from "react-textfit";
 
export default function Word({word, linesComplete, submit}: {word: string, linesComplete: number, submit: () => void}) {
    const [timeLeft, setTimeLeft] = useState(40);
    const [timePercentageLeft, setTimePercentageLeft] = useState(100);

    useEffect(() => {
        timeLeft > 0 && setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
        timeLeft > 0 && setTimeout(() => setTimePercentageLeft(timePercentageLeft - (100/40)), 1000)
        timeLeft < 1 && setTimeout(() => submit(), 100)
    }, [timeLeft]);
 
  return (
    <div className="flex flex-col w-auto pb-[220px] mx-auto">
        <h1 className="text-center">Your word is</h1>
        <div className="flex w-auto content-center items-center">
        <CircularProgressBar progress={linesComplete * 25} text={`${linesComplete}/4`} gradient={["#00C6FF", "#5BE1C6"]} />
            <Textfit mode="single" className='flex-1 text-center md:px-[100px] pt-[20px] hidden md:block max-h-[211px] leading-none font-bold tracking-[0.06em]' max={211}>
                {word.toUpperCase()}
            </Textfit>
            <Textfit mode="single" className='flex-1 text-center md:px-[100px] pt-[5px] md:pt-[20px] h-[40px] leading-none font-bold tracking-[0.06em] md:hidden' max={40}>
                {word.toUpperCase()}
            </Textfit>
        <CircularProgressBar progress={timePercentageLeft} text={`${timeLeft}s`} gradient={["#00C6FF", "#5BE1C6"]} />
        </div>
    </div>
  )
}