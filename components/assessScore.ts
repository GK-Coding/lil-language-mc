'use server';

import { getRhymes } from "@/app/server";
import nlp from "compromise";
import speechPlugin from "compromise-speech";
nlp.plugin(speechPlugin);

export const assessScore = async (lines: string[], word: string) => {
    const endWords = lines.filter(line => {
        return line.split(" ").length >= 3;
    }).map(line2 => {
        const doc = nlp(line2)
        const terms = doc.json({
            trim: true,
            // @ts-ignore
            syllables: true,
        })[0]
        return terms;
        const wordsInLine = line2.split(" ");
        return wordsInLine[wordsInLine.length - 1];
    });

    // const result = await getRhymes(word, endWords);

    return endWords;
}