import { generate, count } from 'random-words'
import { getWordByDifficulty, getWordData } from '../../server';
import postgres from 'postgres';
import Word from '@/components/Word';
import FreestyleForm from '@/components/FreestyleForm';
import StartSection from '@/components/StartSection';

export default async function FreestylePage({params: {difficulty}}: {params: {difficulty: "easy" | "medium" | "hard"}}) {
  // Function returns one by default but not as array so we explicitly define 1 for consistency
  const words = generate(1);
  const wordData = await getWordData(words.at(0) ?? "");

  const word = await getWordByDifficulty(difficulty);

  return (
    <main className='mx-auto'>
      <FreestyleForm word={word!.word} />
    </main>
  )
}
