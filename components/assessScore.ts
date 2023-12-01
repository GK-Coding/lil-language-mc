'use server';

import { getPronunciation, getPronunciations, getRhymes } from "@/app/server";
import nlp from "compromise";
import speechPlugin from "compromise-speech";
import { Word } from "@/types/word";
nlp.plugin(speechPlugin);

export const assessScore = async (lines: string[], word: string) => {
    const eligibleLines = lines.filter(line => {
        return line.split(" ").length >= 3;
    }); 

    const result = [];

    for (const line in eligibleLines) {
        const trimmed = line.trimEnd();
        const wordListWithPronunciations = await getPronunciations(trimmed.split(" "))
        result.push(wordListWithPronunciations.map(async wordInLine => {
            const doc = nlp(wordInLine.value)
            //@ts-ignore
            
            const pronunciation = await getPronunciation(wordInLine);
            return {
                value: wordInLine,
                //@ts-ignore
                syllables: doc.syllables(),
                pronunciation
            };
        }));

    }

    // const result = await getRhymes(word, endWords);

    return result;
}