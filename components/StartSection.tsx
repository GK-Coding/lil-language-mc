"use client";

import Image from 'next/image'
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
    const [difficultyMenuOpen, setDifficultyMenuOpen] = useState<boolean>(false);

    const handleDifficultyButton = (difficulty: "easy" | "medium" | "hard") => {
        if (difficultyMenuOpen) {
            setDifficulty(difficulty)
        }
        setDifficultyMenuOpen(!difficultyMenuOpen)
    }

    if (countdownActive) {
        return <>
            <div className="hidden md:flex absolute top-[25px] left-0 right-0 w-full md:w-[697px] flex justify-center mx-auto z-10">
                <div className={(difficulty === "easy" ? "bg-[#FFF] dark:bg-[#1C1E1E] " : "") + "rounded-[25px] px-[25px] mx-[9px] py-[20px] justify-start items-center gap-2.5 flex"}>
                    <div className={"text-[14px] md:text-[25px] font-bold tracking-wider flex flex-row items-center"}><Image src="Easy.svg" height={28.01} width={32.43} alt={"Easy Icon"} className='pr-[10px]' /> Easy</div>
                </div>
                <div className={(difficulty === "medium" ? "bg-[#FFF] dark:bg-[#1C1E1E] " : "") + "rounded-[25px] px-[25px] mx-[9px] py-[20px] justify-start items-center gap-2.5 flex"}>
                    <div className={"text-[14px] md:text-[25px] font-bold tracking-wider flex flex-row items-center"}><Image src="Medium.svg" height={28.01} width={32.43} alt={"Medium Icon"} className='pr-[10px]' /> Medium</div>
                </div>
                <div className={(difficulty === "hard" ? "bg-[#FFF] dark:bg-[#1C1E1E] " : "") + "rounded-[25px] px-[25px] mx-[9px] py-[20px] justify-start items-center gap-2.5 flex"}>
                    <div className={"text-[14px] md:text-[25px] font-bold tracking-wider flex flex-row items-center"}><Image src="Hard.svg" height={33.84} width={45.63} alt={"Hard Icon"} className='pr-[10px]' /> Hard</div>
                </div>
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
            <h1 className='absolute leading-0 left-[30px] md:left-[100px] top-[30px] md:top-[25px] text-[32px] md:text-[61px]'>LLMC <span className='align-text-top text-[#5DE3C8] text-[13px] md:text-[16px]'>alpha</span></h1>
            <div className="hidden md:flex absolute top-[25px] left-0 right-0 w-[697px] flex justify-center mx-auto z-10">
                <button type="button" onClick={() => setDifficulty("easy")} className={(difficulty === "easy" ? "bg-[#FFF] dark:bg-[#1C1E1E] " : "") + "rounded-[25px] px-[25px] mx-[9px] py-[20px] justify-start items-center gap-2.5 flex"}>
                    <div className={"text-[14px] md:text-[25px] font-bold tracking-wider flex flex-row items-center"}><Image src="Easy.svg" height={28.01} width={32.43} alt={"Easy Icon"} className='pr-[10px]' /> Easy</div>
                </button>
                <button type="button" onClick={() => setDifficulty("medium")} className={(difficulty === "medium" ? "bg-[#FFF] dark:bg-[#1C1E1E] " : "") + "rounded-[25px] px-[25px] mx-[9px] py-[20px] justify-start items-center gap-2.5 flex"}>
                    <div className={"text-[14px] md:text-[25px] font-bold tracking-wider flex flex-row items-center"}><Image src="Medium.svg" height={28.01} width={32.43} alt={"Medium Icon"} className='pr-[10px]' /> Medium</div>
                </button>
                <button type="button" onClick={() => setDifficulty("hard")} className={(difficulty === "hard" ? "bg-[#FFF] dark:bg-[#1C1E1E] " : "") + "rounded-[25px] px-[25px] mx-[9px] py-[20px] justify-start items-center gap-2.5 flex"}>
                    <div className={"text-[14px] md:text-[25px] font-bold tracking-wider flex flex-row items-center"}><Image src="Hard.svg" height={33.84} width={45.63} alt={"Hard Icon"} className='pr-[10px]' /> Hard</div>
                </button>
            </div>
            <div className="bg-[#FFF] dark:bg-[#1C1E1E] flex flex-row md:hidden absolute top-[25px] right-[30px] w-[153px] flex justify-center z-10 rounded-[10px]">
                {difficulty === "easy" && !difficultyMenuOpen && <button type="button" onClick={() => handleDifficultyButton("easy")} className={"px-[25px] h-[38px] mb-[10px] justify-start items-center gap-2.5 flex"}>
                    <div className={"text-[14px] md:text-[25px] font-bold tracking-wider flex flex-row items-center absolute left-[15px] top-[15px]"}><Image src="Easy.svg" height={18} width={30} alt={"Easy Icon"} className='pr-[10px]' /> Easy</div>
                    <div className='absolute right-[17px] top-[19px]'><Image src="DownArrow.svg" height={20} width={18} alt={"Down Arrow"} className='dark:hidden ml-[4px] px-[3px] py-[2px]' /><Image src="WhiteDownArrow.svg" height={20} width={18} alt={"Down Arrow"} className='hidden dark:block ml-[4px] px-[3px] py-[2px]' /></div>
                </button>}
                {difficulty === "medium" && !difficultyMenuOpen && <button type="button" onClick={() => handleDifficultyButton("medium")} className={"px-[25px] h-[38px] mb-[10px] justify-start items-center gap-2.5 flex"}>
                    <div className={"text-[14px] md:text-[25px] font-bold tracking-wider flex flex-row items-center absolute left-[15px] top-[15px]"}><Image src="Medium.svg" height={18} width={30} alt={"Medium Icon"} className='pr-[10px]' /> Medium</div>
                    <div className='absolute right-[17px] top-[19px]'><Image src="DownArrow.svg" height={20} width={18} alt={"Down Arrow"} className='dark:hidden ml-[4px] px-[3px] py-[2px]' /><Image src="WhiteDownArrow.svg" height={20} width={18} alt={"Down Arrow"} className='hidden dark:block ml-[4px] px-[3px] py-[2px]' /></div>
                </button>}
                {difficulty === "hard" && !difficultyMenuOpen && <button type="button" onClick={() => handleDifficultyButton("hard")} className={"px-[25px] h-[48px] justify-start items-center gap-2.5 flex"}>
                    <div className={"text-[14px] md:text-[25px] font-bold tracking-wider flex flex-row items-center absolute left-[15px] top-[15px]"}><Image src="Hard.svg" height={18} width={30} alt={"Hard Icon"} className='pr-[10px]' /> Hard</div>
                    <div className='absolute right-[17px] top-[19px]'><Image src="DownArrow.svg" height={20} width={18} alt={"Down Arrow"} className='dark:hidden ml-[4px] px-[3px] py-[2px]' /><Image src="WhiteDownArrow.svg" height={20} width={18} alt={"Down Arrow"} className='hidden dark:block ml-[4px] px-[3px] py-[2px]' /></div>
                </button>}
                { difficultyMenuOpen && <div className="flex flex-col"><button type="button" onClick={() => handleDifficultyButton("easy")} className={"px-[25px] h-[38px] mb-[10px] justify-start items-center gap-2.5 flex"}>
                    <div className={"text-[14px] md:text-[25px] font-bold tracking-wider flex flex-row items-center absolute left-[15px] top-[15px]"}><Image src="Easy.svg" height={18} width={30} alt={"Easy Icon"} className='pr-[10px]' /> Easy</div>
                </button>
                <button type="button" onClick={() => handleDifficultyButton("medium")} className={"px-[25px] h-[38px] mb-[10px] justify-start items-center gap-2.5 flex"}>
                    <div className={"text-[14px] md:text-[25px] font-bold tracking-wider flex flex-row items-center absolute left-[15px] top-[57px]"}><Image src="Medium.svg" height={18} width={30} alt={"Medium Icon"} className='pr-[10px]' /> Medium</div>
                </button>
                <button type="button" onClick={() => handleDifficultyButton("hard")} className={"px-[25px] h-[38px] justify-start items-center gap-2.5 flex"}>
                    <div className={"text-[14px] md:text-[25px] font-bold tracking-wider flex flex-row items-center absolute left-[15px] top-[100px]"}><Image src="Hard.svg" height={18} width={30} alt={"Hard Icon"} className='pr-[10px]' /> Hard</div>
                </button></div> }
            </div>
            <div className="absolute top-0 left-0 bottom-0 right-0 flex justify-center items-center max-w-[1920px] md:px-[100px] mx-auto">
                <div className="flex-col justify-center items-center gap-10 flex">
                    <div className="flex-col justify-center items-center flex">
                        <div className="text-center">
                            <span className="text-[22px] md:text-[61px] font-extrabold tracking-[3.05px]">Your word is </span>
                            <span className="text-[22px] md:text-[61px] font-bold tracking-[-4px]">________<br /></span>
                            <span className="text-[22px] md:text-[61px] font-extrabold tracking-[3.05px]">Write 4 bars in 30 seconds</span>
                        </div>
                        <div className="md:w-[842px] text-center text-[16px] md:text-[24px] font-normal tracking-wide">Bonus: End with the Keyword</div>
                    </div>
                    <div className="text-[18px] md:text-[30px] px-[66px] pb-[13px] pt-[17px] bg-gradient-to-r from-teal-300 to-teal-300 rounded-[12px] md:rounded-[25px] flex-col justify-center items-center gap-2.5 flex">
                        <button className="text-zinc-900 font-bold tracking-wider" onClick={() => setCountdownActive(true)}>Reveal Word</button>
                    </div>
                </div>
            </div>
            <footer className="absolute bottom-0 w-full max-w-[1920px] mx-auto text-center pb-[20px] opacity-50">
            LLMC ©{new Date().getFullYear()}. All rights reserved.
            </footer>
        </>
    }
}