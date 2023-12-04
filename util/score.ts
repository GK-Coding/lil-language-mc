const baseScore = 100;

export const perfectRhymeScore = 1;
export const nearRhymeScore = 0.8;
export const maybeRhymeScore = 0.5;

const rhymeQualityWeight = 1;
const syllableMatchWeight = 0.5;
const complexityWeight = 0.3;
const bonusPointsWeight = 0.2;
const penaltyWeight = 0.2;

export const getScore = ({rhymeQuality, syllableMatch, complexity, bonusPoints, penalty}: {rhymeQuality: number, syllableMatch: number, complexity: number, bonusPoints: number, penalty: number}) => {
    return Math.round((rhymeQuality * rhymeQualityWeight + syllableMatch * syllableMatchWeight + complexity * complexityWeight + bonusPoints * bonusPointsWeight) * baseScore - (penalty * penaltyWeight));
}