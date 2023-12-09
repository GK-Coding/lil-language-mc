import { syllable } from "syllable";
import { hasDuplicates } from ".";

const baseScore = 100;

export const perfectRhymeScore = 1;
export const nearRhymeScore = 0.8;
export const maybeRhymeScore = 0.5;

const rhymeQualityWeight = 1;
const syllableMatchWeight = 0.5;
const complexityWeight = 0.3;
const bonusPointsWeight = 0.2;
const penaltyWeight = 0.2;

export const getScore = ({ rhymeQuality, syllableMatch, complexity, bonusPoints, penalty, wordCountPenalty }: { rhymeQuality: number, syllableMatch: number, complexity: number, bonusPoints: number, penalty: number, wordCountPenalty: number }) => {
    console.log({
        rhymeQuality,
        syllableMatch,
        complexity,
        bonusPoints,
        penalty,
        wordCountPenalty
    })
    return Math.round(((rhymeQuality * rhymeQualityWeight + syllableMatch * syllableMatchWeight + complexity * complexityWeight + bonusPoints * bonusPointsWeight) * baseScore - (penalty * penaltyWeight)) * wordCountPenalty);
}

// export const getFleschKincaid = (lines: string[]) => {
//     const joinedLines = lines.join(' ');
//     const totalWords = joinedLines.split(' ').length;
//     const totalSentences = lines.length;
//     const totalSyllables = syllable(joinedLines);

//     console.log(totalWords, totalSentences, totalSyllables);

//     const fk = 0.39 * (totalWords / totalSentences) + 11.8 * (totalSyllables / totalWords) - 15.59;

//     console.log(fk);

//     if (isNaN(fk)) {
//         return 0.3;
//     } else if (fk < 1) {
//         return 0.3;
//     } else if (fk < 5) {
//         return 0.5;
//     } else if (fk < 11) {
//         return 0.7;
//     } else {
//         return 1;
//     }
// }

export const getComplexity = (lines: string[]) => {
    const numberOfBars = lines.length;
    const wordCount = lines.join(' ').split(' ').length;

    return Math.max(0, Math.min(1, (Math.round(wordCount / numberOfBars) - 4) * 0.1))
}

export const getSyllableMatch = (lines: string[]) => {
    let comparisons = [];

    for (let i = 0; i < lines.length; i += 2) {
        if (lines.length >= i + 2) {
            console.log(syllable(lines[i]), syllable(lines[i + 1]));
            const diff = Math.abs(syllable(lines[i]) - syllable(lines[i + 1]));
            comparisons.push(diff)
        }
    }

    const comparisonAverage = comparisons.reduce((acc, val) => acc + val, 0) / comparisons.length;

    const syllableMatch = 1.0 - (comparisonAverage * 0.1);

    return syllableMatch;
}

export const getBonusPoints = (percentageOfTimeLeft: number, endedWithKeyword: boolean) => {
    const timeBonus = percentageOfTimeLeft >= 10 ? (percentageOfTimeLeft * 0.02) : 0;
    const keywordBonus = endedWithKeyword ? 0.4 : 0;

    return timeBonus + keywordBonus;
}

export const getPenalty = (percentageOfTimeLeft: number, lines: string[]) => {
    const timePenalty = percentageOfTimeLeft == 0 ? 0.5 : 0;

    // check that last word of each line is unique
    const lastWords = lines.map(line => {
        const words = line.split(' ');
        return words[words.length - 1];
    });
    const repeatPenalty = hasDuplicates(lastWords) ? 0.5 : 0;

    return timePenalty + repeatPenalty;
}

export const getWordCountPenalty = (lines: string[]) => {
    const shortLines = lines.map(line => line.split(' ').length).filter(lineLength => lineLength < 4).length;
    const wordCountPenalty = 1 - ((0.75 / lines.length) * shortLines)
    return wordCountPenalty;
}