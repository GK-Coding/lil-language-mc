'use server';

import { getPronunciation, getPronunciations, getRhymes } from "@/app/server";
import nlp from "compromise";
import speechPlugin from "compromise-speech";
import { Word } from "@/types/word";
nlp.plugin(speechPlugin);

export const getRhymeData = async (lines: string[], word: string) => {
    const eligibleLines = lines.filter(line => {
        return line.split(" ").length >= 3;
    });

    const mappedLines = await Promise.all(eligibleLines.map(async (line, index) => {
        const trimmed = line.trimEnd();
        return await Promise.all(trimmed.split(" ").map(async wordInLine => {
            const doc = nlp(wordInLine)
            const pronunciation = await getPronunciation(wordInLine);
            return {
                value: wordInLine,
                //@ts-ignore
                syllables: doc.syllables(),
                pronunciation
            };
        }));

    }))

    const linePronunciations = await Promise.all(mappedLines.map(async line => {
        return line.map(word => {
            return word.pronunciation;
        }).join(' ');
    }));

    const targetWordPronunciation: string = await getPronunciation(word);

    return {
        mappedLines,
        linePronunciations,
        targetWordPronunciation
    };
}

export const getScore = async (lines: string[], word: string) => {

}