/**
 * 연속 create_note 호출 테스트
 *
 * 실제 Claude Desktop 환경을 시뮬레이션하여 연속 노트 생성 시 발생할 수 있는 문제를 검증합니다.
 */

import { executeTool } from '../../src/tools';
import { createTestContext, cleanupTestContext } from '../test-helpers';
import { ToolExecutionContext } from '../../src/tools/types';
import * as fs from 'fs';
import * as path from 'path';

describe('Consecutive create_note calls (Claude Desktop simulation)', () => {
  let context: ToolExecutionContext;

  beforeEach(() => {
    context = createTestContext();
  });

  afterEach(() => {
    cleanupTestContext(context);
  });

  it('동일한 context에서 연속으로 노트를 생성해야 함', async () => {
    // 첫 번째 노트 생성
    const result1 = await executeTool('create_note', {
      title: 'First Note',
      content: 'Content of first note',
    }, context);

    expect(result1.isError).toBeUndefined();
    expect(result1.content[0]?.text).toContain('노트가 생성되었습니다');

    // 두 번째 노트 생성
    const result2 = await executeTool('create_note', {
      title: 'Second Note',
      content: 'Content of second note',
    }, context);

    expect(result2.isError).toBeUndefined();
    expect(result2.content[0]?.text).toContain('노트가 생성되었습니다');

    // 세 번째 노트 생성
    const result3 = await executeTool('create_note', {
      title: 'Third Note',
      content: 'Content of third note',
    }, context);

    expect(result3.isError).toBeUndefined();
    expect(result3.content[0]?.text).toContain('노트가 생성되었습니다');

    // 모든 노트가 다른 ID를 가져야 함
    const id1 = result1._meta?.metadata?.id;
    const id2 = result2._meta?.metadata?.id;
    const id3 = result3._meta?.metadata?.id;

    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);

    // 파일이 실제로 생성되었는지 확인
    const files = fs.readdirSync(context.vaultPath);
    expect(files.length).toBe(3);
  });

  it('동일한 제목으로 연속 노트 생성해야 함', async () => {
    const title = 'Same Title Note';

    // 동일한 제목으로 세 개의 노트 생성
    const results = [];
    for (let i = 0; i < 3; i++) {
      const result = await executeTool('create_note', {
        title,
        content: `Content ${i + 1}`,
      }, context);
      results.push(result);
    }

    // 모든 노트가 성공적으로 생성되어야 함
    for (const result of results) {
      expect(result.isError).toBeUndefined();
      expect(result.content[0]?.text).toContain('노트가 생성되었습니다');
    }

    // 모든 노트가 다른 ID를 가져야 함
    const ids = results.map(r => r._meta?.metadata?.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);

    // 파일이 실제로 생성되었는지 확인
    const files = fs.readdirSync(context.vaultPath);
    expect(files.length).toBe(3);
  });

  it('빠른 연속 호출에서도 고유한 UID를 생성해야 함', async () => {
    // 10개의 노트를 빠르게 연속 생성
    const promises = Array.from({ length: 10 }, (_, i) =>
      executeTool('create_note', {
        title: `Rapid Note ${i + 1}`,
        content: `Content ${i + 1}`,
      }, context)
    );

    const results = await Promise.all(promises);

    // 모든 노트가 성공적으로 생성되어야 함
    for (const result of results) {
      expect(result.isError).toBeUndefined();
    }

    // 모든 ID가 고유해야 함
    const ids = results.map(r => r._meta?.metadata?.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(10);

    // 파일이 실제로 생성되었는지 확인
    const files = fs.readdirSync(context.vaultPath);
    expect(files.length).toBe(10);
  });

  it('파일명의 UID와 노트 ID가 일치해야 함', async () => {
    const result = await executeTool('create_note', {
      title: 'UID Consistency Test',
      content: 'Testing UID consistency',
    }, context);

    const noteId = result._meta?.metadata?.id as string;
    const filePath = result._meta?.metadata?.filePath as string;
    const fileName = path.basename(filePath);

    // 파일명에 노트 ID가 포함되어야 함
    expect(fileName).toContain(noteId);
  });

  it('다양한 카테고리로 연속 생성해야 함', async () => {
    const categories = ['Projects', 'Areas', 'Resources', 'Archives', undefined];

    const results = [];
    for (const category of categories) {
      const input: any = {
        title: `Note in ${category || 'Zettelkasten'}`,
        content: 'Content',
      };
      if (category) {
        input.category = category;
      }

      const result = await executeTool('create_note', input, context);
      results.push(result);
    }

    // 모든 노트가 성공적으로 생성되어야 함
    for (const result of results) {
      expect(result.isError).toBeUndefined();
    }

    const files = fs.readdirSync(context.vaultPath);
    expect(files.length).toBe(5);
  });

  it('태그와 링크가 포함된 연속 생성해야 함', async () => {
    // 첫 번째 노트 (링크 없음)
    const result1 = await executeTool('create_note', {
      title: 'First Tagged Note',
      content: 'Content',
      tags: ['tag1', 'tag2'],
    }, context);

    const id1 = result1._meta?.metadata?.id as string;

    // 두 번째 노트 (첫 번째 노트로 링크)
    const result2 = await executeTool('create_note', {
      title: 'Second Tagged Note',
      content: 'Content',
      tags: ['tag2', 'tag3'],
      links: [id1],
    }, context);

    const id2 = result2._meta?.metadata?.id as string;

    // 세 번째 노트 (두 노트로 링크)
    const result3 = await executeTool('create_note', {
      title: 'Third Tagged Note',
      content: 'Content',
      tags: ['tag3', 'tag4'],
      links: [id1, id2],
    }, context);

    // 모든 노트가 성공적으로 생성되어야 함
    expect(result1.isError).toBeUndefined();
    expect(result2.isError).toBeUndefined();
    expect(result3.isError).toBeUndefined();

    // 파일이 실제로 생성되었는지 확인
    const files = fs.readdirSync(context.vaultPath);
    expect(files.length).toBe(3);
  });

  it('긴 세션에서 많은 노트를 생성해야 함', async () => {
    // 20개의 노트를 순차적으로 생성 (실제 세션 시뮬레이션)
    const results = [];
    for (let i = 0; i < 20; i++) {
      const result = await executeTool('create_note', {
        title: `Session Note ${i + 1}`,
        content: `This is note number ${i + 1} in a long session`,
        tags: [`batch-${Math.floor(i / 5)}`],
      }, context);
      results.push(result);
    }

    // 모든 노트가 성공적으로 생성되어야 함
    for (let i = 0; i < results.length; i++) {
      expect(results[i].isError).toBeUndefined();
    }

    // 모든 ID가 고유해야 함
    const ids = results.map(r => r._meta?.metadata?.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(20);

    // 파일이 실제로 생성되었는지 확인
    const files = fs.readdirSync(context.vaultPath);
    expect(files.length).toBe(20);
  });

  it('Claude Desktop 배열 문자열화 처리를 테스트해야 함', async () => {
    // Claude Desktop이 배열을 문자열로 직렬화하는 경우
    const result = await executeTool('create_note', {
      title: 'Array String Test',
      content: 'Content',
      tags: '["tag1", "tag2", "tag3"]', // 문자열로 된 배열
      links: '["link1", "link2"]', // 문자열로 된 배열
    }, context);

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('노트가 생성되었습니다');

    // 태그가 올바르게 파싱되었는지 확인
    const tags = result._meta?.metadata?.tags as string[];
    expect(tags).toEqual(['tag1', 'tag2', 'tag3']);
  });
});
