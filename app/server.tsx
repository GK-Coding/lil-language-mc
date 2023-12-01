import postgres from 'postgres';

export type Word = {
    id: number;
    word: string;
    pronunciation: string;
    rhymescore: number;
}

export type RZWord = {
    word: string;
    score: number;
    numSyllables: number;
    tags: string[];
    defs: string[];
}

export async function getPronunciation(word: string) {
    if (word == "") {
        return;
    }

    const res = await fetch(`https://api.datamuse.com/words?sp=${word}&qe=sp&md=r&max=1`);

    if (!res.ok) {
        throw new Error('Failed to fetch data');
    }

    const json = await res.json();
    const tags = json[0].tags;
    const pronTag = tags.find((tag: string) => tag.startsWith("pron:"));

    return pronTag?.split(":")[1];
}

export async function getPronunciations(words: string[]) {
    if (words.length < 1) {
        return [];
    }

    const wordsWithPronunciations = []

    for (const word of words) {
        const pronunciation = await getPronunciation(word);
        wordsWithPronunciations.push({
            value: word,
            pronunciation
        })
    }

    return wordsWithPronunciations;
}

export async function getRhymeScore(word: string): Promise<number> {
    if (word == "") {
        return 0;
    }

    const res = await fetch(`https://api.datamuse.com/words?sl=${word}`);

    if (!res.ok) {
        throw new Error('Failed to fetch data');
    }

    const json: any[] = await res.json();

    return json.reduce(function (a, b) {
        if (a !== -1) {
            return a + b["score"]
        }
        return 0;
    }, -1);
}

export async function getRhymes(word: string, wordsToCheck: string[]): Promise<RZWord[]> {
    if (word == "") {
        return [];
    }

    const res = await fetch(`https://api.rhymezone.com/words?k=rza&arhy=1&max=1000&qe=sl&md=fpdlr&sl=${word}`);

    if (!res.ok) {
        throw new Error('Failed to fetch data');
    }

    const json: any[] = await res.json();

    return json.filter(el => {
        return wordsToCheck.includes(el.word);
    });
}

export async function importWordToDatabase(word: string) {
    if (process.env.DATABASE_URL === undefined || word == "") {
        return;
    }

    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

    const pronunciation = await getPronunciation(word);
    const rhymeScore = await getRhymeScore(word);

    const response = await sql`INSERT INTO words (word, pronunciation, rhymescore) VALUES (${word}, ${pronunciation}, ${rhymeScore})`;

    return response;
}

export async function getWordData(word: string) {
    if (process.env.DATABASE_URL === undefined || word === "") {
        return;
    }

    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

    const response: Word[] = await sql`SELECT * FROM words WHERE word=${word}`;

    if (response.length === 0) {
        return await importWordToDatabase(word);
    } else {
        return response;
    }
}

function thirdFromDifficulty(difficulty: "easy" | "medium" | "hard") {
    if (difficulty === "easy") {
        return 3;
    } else if (difficulty === "hard") {
        return 1;
    } else {
        return 2;
    }
}

export async function getWordByDifficulty(difficulty: "easy" | "medium" | "hard") {
    if (process.env.DATABASE_URL === undefined) {
        return;
    }



    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

    const response: Word[] = await sql`
    WITH OrderedScores AS (
      SELECT *,
        NTILE(3) OVER (ORDER BY rhymescore) AS Third
      FROM words
    )
    SELECT *
    FROM OrderedScores
    WHERE Third = ${thirdFromDifficulty(difficulty)}
    ORDER BY RANDOM()
    LIMIT 1;`;

    return response[0];
}