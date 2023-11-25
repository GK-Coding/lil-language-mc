"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function StartSection() {
    const router = useRouter();

    const [timeLeft, setTimeLeft] = useState(3);
    const [countdownActive, setCountdownActive] = useState<boolean>(false);

    useEffect(() => {
        if (countdownActive) {
            timeLeft > 0 && setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            timeLeft == 1 && setTimeout(() => router.push(`/freestyle/${difficulty}`), 100)
        }
    }, [timeLeft, countdownActive]);
    
    const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");

    if (countdownActive) {
        return <>
            <div className="absolute top-[25px] left-0 right-0 w-[697px] flex justify-center mx-auto z-10">
                <button type="button" onClick={() => setDifficulty("easy")} className={(difficulty === "easy" ? "bg-[#1C1E1E] " : "") + "rounded-[25px] px-[25px] py-[20px] justify-start items-center gap-2.5 flex"}>
                    <div className={"text-[25px] font-bold tracking-wider"}>Easy</div>
                </button>
                <button type="button" onClick={() => setDifficulty("medium")} className={(difficulty === "medium" ? "bg-[#1C1E1E] " : "") + "rounded-[25px] px-[25px] py-[20px] justify-start items-center gap-2.5 flex"}>
                    <div className={"text-[25px] font-bold tracking-wider"}>Medium</div>
                </button>
                <button type="button" onClick={() => setDifficulty("hard")} className={(difficulty === "hard" ? "bg-[#1C1E1E] " : "") + "rounded-[25px] px-[25px] py-[20px] justify-start items-center gap-2.5 flex"}>
                    <div className={"text-[25px] font-bold tracking-wider"}>Hard</div>
                </button>
            </div>
            <div className="absolute top-[90px] left-0 right-0 flex justify-center items-center max-w-[1920px] px-[100px] mx-auto">
                <div className="flex-col justify-center items-center gap-10 flex">
                    <div className="flex-col justify-center items-center flex">
                        <div className="text-center">
                            <span className="text-[211px] font-bold tracking-[3.05px]">{timeLeft}</span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    } else {
        return <>
            <div className="absolute top-[25px] left-0 right-0 w-[697px] flex justify-center mx-auto z-10">
                <button type="button" onClick={() => setDifficulty("easy")} className={(difficulty === "easy" ? "bg-[#1C1E1E] " : "") + "rounded-[25px] px-[25px] py-[20px] justify-start items-center gap-2.5 flex"}>
                    <div className={"text-[25px] font-bold tracking-wider"}>Easy</div>
                </button>
                <button type="button" onClick={() => setDifficulty("medium")} className={(difficulty === "medium" ? "bg-[#1C1E1E] " : "") + "rounded-[25px] px-[25px] py-[20px] justify-start items-center gap-2.5 flex"}>
                    <div className={"text-[25px] font-bold tracking-wider"}>Medium</div>
                </button>
                <button type="button" onClick={() => setDifficulty("hard")} className={(difficulty === "hard" ? "bg-[#1C1E1E] " : "") + "rounded-[25px] px-[25px] py-[20px] justify-start items-center gap-2.5 flex"}>
                    <div className={"text-[25px] font-bold tracking-wider"}>Hard</div>
                </button>
            </div>
            <div className="absolute top-0 left-0 bottom-0 right-0 flex justify-center items-center max-w-[1920px] px-[100px] mx-auto">
                <div className="flex-col justify-center items-center gap-10 flex">
                    <div className="flex-col justify-center items-center flex">
                        <div className="text-center">
                            <span className="text-[61px] font-bold tracking-[3.05px]">Your word is </span>
                            <span className="text-[61px] font-bold tracking-[-4px]">________<br /></span>
                            <span className="text-[61px] font-extrabold tracking-[3.05px]">Write 4 bars in 30 seconds</span>
                        </div>
                        <div className="w-[842px] text-center text-2xl font-normal tracking-wide">Bonus: End with the Keyword</div>
                    </div>
                    <div className="px-[66px] py-[15px] bg-gradient-to-r from-teal-300 to-teal-300 rounded-[25px] flex-col justify-center items-center gap-2.5 flex">
                        <button className="text-zinc-900 text-3xl font-bold tracking-wider" onClick={() => setCountdownActive(true)}>Reveal Word</button>
                    </div>
                </div>
            </div>
        </>
    }
}