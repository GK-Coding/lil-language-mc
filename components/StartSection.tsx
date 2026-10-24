"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Waveform } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import Header from './Header';
import useIsMobile from '../hooks/useIsMobile';
import DifficultyBottomSheet from './BottomSheets/DifficultyBottomSheet';
import ModeBottomSheet from './BottomSheets/ModeBottomSheet';
import ModeSelector from './ModeSelector';
import { Difficulty } from '@/types/difficulty';
import { useDailyPrimaryAction } from '@/hooks/useDailyPrimaryAction';

import { getDifficultyOptions, gameModeOptions } from '@/util/options';

type GameMode = "4-Bar Mode" | "Rapid Fire Mode" | "Endless Mode";

export default function StartSection() {
  const router = useRouter();
  const isMobile = useIsMobile();

  const [difficulty, setDifficulty] = useState<Difficulty>("daily");
  const [difficultyMenuOpen, setDifficultyMenuOpen] = useState<boolean>(false);
  const [difficultyBottomSheetOpen, setDifficultyBottomSheetOpen] = useState<boolean>(false);

  const handleDifficultyButton = (difficulty: Difficulty) => {
    if (isMobile) {
      setDifficultyBottomSheetOpen(true);
    } else {
      if (difficultyMenuOpen) {
        setDifficulty(difficulty)
      }
      setDifficultyMenuOpen(!difficultyMenuOpen)
    }
  }

  const handleDifficultySelect = (selectedDifficulty: Difficulty) => {
    setDifficulty(selectedDifficulty);
  }

  // Handle easter egg difficulty change from Header
  const handleEasterEggDifficultyChange = (newDifficulty: Difficulty) => {
    setDifficulty(newDifficulty);
  };

  // Map ZBRA difficulties to base difficulties for routing
  const getRouteDifficulty = (difficulty: Difficulty): string => {
    switch (difficulty) {
      case 'zbra-easy':
        return 'zbra-easy';
      case 'zbra-hard':
        return 'zbra-hard';
      default:
        return difficulty;
    }
  };

  const [newGameMode, setNewGameMode] = useState<GameMode>("Endless Mode");
  const [gameModeMenuOpen, setGameModeMenuOpen] = useState<boolean>(false);
  const [gameModeBottomSheetOpen, setGameModeBottomSheetOpen] = useState<boolean>(false);

  const handleGameModeButton = (gameMode: GameMode) => {
    if (isMobile) {
      setGameModeBottomSheetOpen(true);
    } else {
      if (gameModeMenuOpen) {
        setNewGameMode(gameMode)
      }
      setGameModeMenuOpen(!gameModeMenuOpen)
    }
  }

  const handleGameModeSelect = (selectedMode: GameMode) => {
    setNewGameMode(selectedMode);
  }

  const getRouteGameMode = (gameMode: GameMode): string => {
    switch (gameMode) {
      case 'Endless Mode':
        return 'endless';
      default:
        return 'freestyle';
    }
  };

  // Difficulty options configuration - dynamically include ZBRA modes only if selected
  const difficultyOptions = getDifficultyOptions(difficulty);
  const isDailySelected = difficulty === 'daily';
  const { action: dailyAction } = useDailyPrimaryAction({
    enabled: isDailySelected,
    selectedMode: newGameMode,
    completedModeBehavior: 'view-submission',
  });

  const primaryAction = useMemo(() => {
    if (!isDailySelected) {
      return {
        label: 'PLAY',
        disabled: false,
        onClick: () => router.push(`/${getRouteGameMode(newGameMode)}/${getRouteDifficulty(difficulty)}`),
      };
    }

    if (!dailyAction) {
      return {
        label: 'UNAVAILABLE',
        disabled: true,
        onClick: () => {},
      };
    }

    return {
      label: dailyAction.label,
      disabled: dailyAction.disabled,
      onClick: () => {
        if (!dailyAction.disabled && dailyAction.path) {
          router.push(dailyAction.path);
        }
      },
    };
  }, [dailyAction, difficulty, isDailySelected, newGameMode, router]);

  const primaryActionTextClass = primaryAction.label.length > 10
    ? 'text-[16px] lg:text-[18px]'
    : 'text-[18px] lg:text-[25px]';

  // Wrapper functions for type safety
  const handleDifficultySelectWrapper = (mode: string) => {
    console.log('handleDifficultySelectWrapper', mode);
    handleDifficultySelect(mode as Difficulty);
  };

  const handleDifficultyButtonWrapper = (mode: string) => {
    console.log('handleDifficultyButtonWrapper', mode);
    handleDifficultyButton(mode as Difficulty);
  };

  const handleGameModeSelectWrapper = (mode: string) => {
    handleGameModeSelect(mode as GameMode);
  };

  const handleGameModeButtonWrapper = (mode: string) => {
    handleGameModeButton(mode as GameMode);
  };

  return (
    <div className='h-full flex flex-col justify-between'>
      <div className='px-[30px] lg:px-[100px] pt-[50px]'>
        <Header 
          difficulty={difficulty} 
          onDifficultyChange={handleEasterEggDifficultyChange}
        />
      </div>
      <div className='flex-1 flex flex-col justify-center'>
      <div className="flex flex-col lg:flex-row justify-center items-center max-w-[2560px] px-[30px] lg:px-[100px] mx-auto flex-1 lg:flex-none pb-[27px] lg:pb-0">
        <div className="flex-col justify-center items-center flex gap-10 flex-1 lg:flex-none">
          <div className="flex-col justify-center items-center flex flex-1 lg:flex-none">
            <div className="text-center font-[termina] font-extrabold text-[22px] lg:text-[75px]">
              CAN YOU FREESTYLE?
            </div>
            <div className="text-center font-[neulis-sans] text-[16px] lg:text-[24px]">
              Write 4 sentences that rhyme with the random keyword given
            </div>
          </div>

          <div className='flex mt-[30px] justify-center lg:h-[73px] w-full lg:w-auto gap-2.5 lg:hidden'>
            <ModeSelector
              options={difficultyOptions}
              selectedMode={difficulty}
              onModeSelect={handleDifficultySelectWrapper}
              onButtonClick={handleDifficultyButtonWrapper}
              onClose={() => setDifficultyMenuOpen(false)}
              isMenuOpen={difficultyMenuOpen}
            />
            <button className={`bg-[#5CE2C7] h-[73px] mx-[25px] rounded-[12px] lg:rounded-[25px] text-black ${primaryActionTextClass} w-full font-bold lg:w-[286px] font-[termina] hidden lg:block whitespace-nowrap disabled:opacity-50 disabled:cursor-default`} onClick={primaryAction.onClick} disabled={primaryAction.disabled}>{primaryAction.label}</button>
            <ModeSelector
              options={gameModeOptions}
              selectedMode={newGameMode}
              onModeSelect={handleGameModeSelectWrapper}
              onButtonClick={handleGameModeButtonWrapper}
              onClose={() => setGameModeMenuOpen(false)}
              isMenuOpen={gameModeMenuOpen}
            />
          </div>
          <button className={`bg-[#5CE2C7] py-[10px] px-[20px] mx-[25px] rounded-[12px] text-black dark:text-white ${primaryActionTextClass} font-bold font-[termina] block lg:hidden w-[calc(100%-50px)] whitespace-nowrap disabled:opacity-50 disabled:cursor-default`} onClick={primaryAction.onClick} disabled={primaryAction.disabled}>{primaryAction.label}</button>

        </div>
      </div>

      <div className="hidden lg:flex mt-[50px] justify-center h-[73px]">
        {/* Desktop View */}
        <ModeSelector
          options={difficultyOptions}
          selectedMode={difficulty}
          onModeSelect={handleDifficultySelectWrapper}
          onButtonClick={handleDifficultyButtonWrapper}
          onClose={() => setDifficultyMenuOpen(false)}
          isMenuOpen={difficultyMenuOpen}
          className="hidden lg:flex"
        />

        <button
          className={`bg-[#5CE2C7] h-[73px] mx-[25px] rounded-[12px] lg:rounded-[25px] text-black ${primaryActionTextClass} font-bold lg:w-[286px] font-[termina] hidden lg:block whitespace-nowrap disabled:opacity-50 disabled:cursor-default`}
          onClick={primaryAction.onClick}
          disabled={primaryAction.disabled}
        >
          {primaryAction.label}
        </button>

        {/* Desktop View */}
        <ModeSelector
          options={gameModeOptions}
          selectedMode={newGameMode}
          onModeSelect={handleGameModeSelectWrapper}
          onButtonClick={handleGameModeButtonWrapper}
          onClose={() => setGameModeMenuOpen(false)}
          isMenuOpen={gameModeMenuOpen}
          className="hidden lg:flex"
        />
      </div>
      <div className="flex justify-center mt-7 mb-5"><Link href="/studio" className="inline-flex items-center gap-3 rounded-xl border border-current/20 px-6 py-3 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"><Waveform size={19} />Live rhyme studio<span className="text-[10px] text-emerald-700 dark:text-[#5CE2C7]">NEW</span></Link></div>
      </div>
      <footer className="w-full mx-auto text-center pb-[20px] opacity-50 font-[neulis-sans] font-bold text-[#565757] hidden lg:block">
        ©{new Date().getFullYear()} LineZero Studio. All rights reserved.
      </footer>

      {/* Bottom Sheets for Mobile */}
      <DifficultyBottomSheet
        isOpen={difficultyBottomSheetOpen}
        onClose={() => setDifficultyBottomSheetOpen(false)}
        difficulty={difficulty}
        onDifficultySelect={handleDifficultySelect}
      />

      <ModeBottomSheet
        isOpen={gameModeBottomSheetOpen}
        onClose={() => setGameModeBottomSheetOpen(false)}
        gameMode={newGameMode}
        onGameModeSelect={handleGameModeSelect}
      />
    </div>
  );
}
