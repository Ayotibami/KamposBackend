
import { pool } from '../src/config/db';
import argon2 from 'argon2';

const FIRST_NAMES = [
    'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
    'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
    'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa',
    'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley'
];

const LAST_NAMES = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
    'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
    'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker'
];

const MAJORS = [
    'Computer Science', 'Engineering', 'Mathematics', 'Physics', 'Biology',
    'Chemistry', 'Psychology', 'Sociology', 'English', 'History',
    'Economics', 'Business', 'Art', 'Music', 'Philosophy'
];

const GIST_TEXTS = [
    "Just finished my final exam! So relieved.",
    "Anyone else struggling with Calculus III?",
    "The cafeteria food is actually decent today.",
    "Looking for study partners for CS101.",
    "Campus library is way too cold.",
    "Can't believe it's already week 8.",
    "Kampos app is looking fire 🔥",
    "Lost my ID card near the gym, DM if found.",
    "Professor Smith's lecture was mind-blowing.",
    "Going to the game tonight? #GoTeam",
    "Why is parking so impossible here?",
    "Successfully deployed my first app!",
    "Need coffee recommendations ASAP.",
    "Anyone want to play soccer this weekend?",
    "Hackathon next week! Who's joining?",
    "The sunset from the quad is beautiful today.",
    "Midterms are hitting hard right now.",
    "Does anyone have notes for History 202?",
    "Just joined the chess club, come play!",
    "Sleep schedule is officially ruined."
];

function getRandomItem<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seed() {
    console.log('🌱 Starting seed...');

    try {
        // Generate hashed password once
        const passwordHash = await argon2.hash('password123');

        // Fetch valid majors
        // Fetch valid majors
        const { rows: majorRows } = await pool.query(`SELECT * FROM major`);
        if (majorRows.length > 0) {
            console.log('Major row example:', majorRows[0]);
        }
        // Fallback to whatever column we find or empty
        const validMajors = majorRows.map((r: any) => r.major_tag || r.tag || r.name || r.id);

        if (validMajors.length === 0) {
            console.error('No majors found in DB! Cannot seed profiles.');
            return;
        }

        for (let i = 0; i < 50; i++) {
            const firstName = getRandomItem(FIRST_NAMES);
            const lastName = getRandomItem(LAST_NAMES);
            const randomNum = getRandomInt(100, 9999);
            const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomNum}@example.com`;
            const avitag = `${firstName.toLowerCase()}${lastName.toLowerCase()}${randomNum}`;

            // 1. Create Account
            const { rows: accountRows } = await pool.query(
                `INSERT INTO accounts (email, password_hash, auth_provider, is_otp_verified, account_status)
         VALUES (LOWER($1), $2, 'EMAIL', TRUE, 'ACTIVE')
         ON CONFLICT (email) DO NOTHING
         RETURNING account_id`,
                [email, passwordHash]
            );

            if (accountRows.length === 0) {
                console.log(`Skipping duplicate email: ${email}`);
                continue;
            }

            const accountId = accountRows[0].account_id;

            // 2. Create Student Profile
            await pool.query(
                `INSERT INTO student_profiles (
           avitag, account_id, first_name, last_name, display_name, 
           major_tag, level, bio, profile_status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE')
         ON CONFLICT (avitag) DO NOTHING`,
                [
                    avitag,
                    accountId,
                    firstName,
                    lastName,
                    `${firstName} ${lastName}`,
                    getRandomItem(validMajors),
                    getRandomItem([100, 200, 300, 400, 500]),
                    `Student at Kampos. majoring in ${getRandomItem(validMajors)}.`
                ]
            );

            console.log(`Created user: ${avitag} (${email})`);

            // 3. Create Gists
            const gistCount = getRandomInt(1, 5);
            for (let j = 0; j < gistCount; j++) {
                await pool.query(
                    `INSERT INTO gists (avitag, gist_text, gist_status, created_at)
           VALUES ($1, $2, 'APPROVED', NOW() - ($3 || ' days')::INTERVAL)`,
                    [
                        avitag,
                        getRandomItem(GIST_TEXTS),
                        getRandomInt(0, 30) // Random date within last 30 days
                    ]
                );
            }
        }

        console.log('✅ Seeding complete!');
    } catch (err) {
        console.error('❌ Seeding failed:', err);
    } finally {
        await pool.end();
    }
}

seed();
