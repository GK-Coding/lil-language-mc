'use server';

import { getRhymes } from "@/app/server";

export const assessScore = async (lines: string[], word: string) => {
    const endWords = lines.filter(line => {
        return line.split(" ").length > 3;
    }).map(line2 => {
        const wordsInLine = line2.split(" ");
        return wordsInLine[wordsInLine.length - 1];
    });

    const result = await getRhymes(word, endWords);

    return result;
}