
import { organizeNotes } from '../packages/mcp-server/dist/tools/organize-notes';
import { createNewNote, saveNote } from '../packages/storage-md/dist/note-manager';
import { logger } from '../packages/common/dist/index';
import { DEFAULT_EXECUTION_POLICY } from '../packages/mcp-server/dist/tools/execution-policy';
import path from 'path';
import fs from 'fs';

async function runVerification() {
    const testVaultPath = path.join(process.cwd(), 'test-vault');

    // Ensure test vault exists
    if (!fs.existsSync(testVaultPath)) {
        fs.mkdirSync(testVaultPath, { recursive: true });
    }

    logger.info(`Using test vault at: ${testVaultPath}`);

    // Create some sample notes
    const note1 = createNewNote(
        'Project Alpha Meeting',
        'Discussed the roadmap for Q4. Need to sync with the design team regarding the new UI components.',
        path.join(testVaultPath, 'project-alpha-meeting.md'),
        'Projects',
        { tags: ['meeting', 'work'] }
    );

    const note2 = createNewNote(
        'UI Components Design',
        'The new UI components should be consistent with the design system. Check the button styles.',
        path.join(testVaultPath, 'ui-components.md'),
        'Areas',
        { tags: ['design'] }
    );

    const note3 = createNewNote(
        'Shopping List',
        'Milk, Eggs, Bread. Need to buy these for the weekend.',
        path.join(testVaultPath, 'shopping-list.md'),
        'Resources',
        { tags: ['personal'] }
    );

    await saveNote(note1);
    await saveNote(note2);
    await saveNote(note3);

    logger.info('Created sample notes.');

    // Mock Context
    const context = {
        vaultPath: testVaultPath,
        indexPath: path.join(testVaultPath, '.index.db'),
        mode: 'dev' as const,
        logger: logger,
        policy: DEFAULT_EXECUTION_POLICY,
    };

    // Run organize_notes
    logger.info('Running organize_notes (dryRun: true)...');
    try {
        const result = await organizeNotes(
            { dryRun: true, limit: 5 },
            context
        );

        console.log('\n--- Result ---');
        if (result.content && result.content[0] && result.content[0].type === 'text') {
            console.log(result.content[0].text);
        } else {
            console.log(JSON.stringify(result, null, 2));
        }
        console.log('--------------\n');

    } catch (error) {
        logger.error('Verification failed:', error);
    }
}

runVerification().catch(console.error);
