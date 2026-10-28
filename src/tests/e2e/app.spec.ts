import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function enterApp(page: Page): Promise<void> {
  await page.goto('/');
  const safety = page.getByRole('dialog');
  await safety.waitFor({ state: 'visible', timeout: 3000 }).catch(() => undefined);
  if (await safety.isVisible()) {
    await page.getByRole('button', { name: '안전 수칙 확인' }).click();
  }
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function unlockChallenge(page: Page, cardText: string, optionName: string): Promise<void> {
  const card = page.locator('.challenge-card').filter({ hasText: cardText });
  await card.getByRole('radio', { name: optionName }).check();
  await card.getByRole('button', { name: '예측 확인' }).click();
  await card.getByRole('button', { name: '실험실 열기' }).click();
}

test('starts audio only after a gesture and updates the tone room', async ({ page }) => {
  await enterApp(page);
  await expect(page.getByRole('heading', { name: '한 음을 해부해 보세요.' })).toBeVisible();

  const audioButton = page.locator('.audio-status');
  await expect(audioButton).toHaveAttribute('data-audio-state', 'idle');

  await audioButton.click();
  await expect(audioButton).toHaveAttribute('data-audio-state', 'running');

  const square = page.locator('.waveform-option').filter({ hasText: '사각' });
  await square.click();
  await expect(square).toHaveAttribute('aria-pressed', 'true');

  const frequency = page.getByRole('spinbutton', { name: '주파수 숫자 입력' });
  await frequency.fill('220');
  await frequency.press('Tab');
  const frequencyReadout = page.locator('.control-panel .field-value').first();
  await expect(frequencyReadout).toContainText('A3');
  await expect(frequencyReadout).toContainText('220 Hz');

  await page.locator('.play-toggle').click();
  await expect(page.locator('.play-status')).toContainText('재생 중');
  await expect(page.locator('.play-status')).toContainText('A3');
  await page.locator('.play-toggle').click();
  await expect(page.locator('.play-status')).toContainText('정지');
});

test('runs the sequencer playhead and stops cleanly', async ({ page }) => {
  await enterApp(page);
  await page.goto('/#/rhythm');
  await expect(page.getByRole('heading', { name: '8칸에 리듬을 쓰세요.' })).toBeVisible();

  const play = page.locator('.transport-play');
  await play.click();
  await expect(play).toContainText('정지');
  await expect(page.locator('.step-card.is-playing')).toHaveCount(1, { timeout: 3000 });
  await page.waitForTimeout(300);
  await expect(page.locator('.step-card.is-playing')).toHaveCount(1);

  await play.click();
  await expect(play).toContainText('재생');
  await expect(page.locator('.step-card.is-playing')).toHaveCount(0);
});

test('completes a challenge through the prediction gate and resets progress', async ({ page }) => {
  await enterApp(page);
  await page.goto('/#/challenges');

  await unlockChallenge(page, 'C 메이저 화음 조립', '0 · 4 · 7 반음');
  await expect(page).toHaveURL(/#\/chords/);
  await expect(page.locator('.chord-name')).toHaveText('G 메이저');
  await page.getByRole('combobox', { name: '화음 근음' }).selectOption('60');
  await expect(page.locator('.chord-name')).toHaveText('C 메이저');

  await page.locator('.challenge-workbench').getByRole('button', { name: '제출하고 비교' }).click();
  await expect(page.locator('.workbench-feedback')).toContainText('목표를 정확히 맞췄습니다');
  await expect(page.locator('.workbench-feedback')).toContainText('0·4·7 반음');

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const raw = localStorage.getItem('waveworks.progress.v1');
        return raw ? JSON.parse(raw).state.challenge.completed : [];
      }),
    )
    .toContain('chord-c-major');

  await page.goto('/#/teacher');
  await expect(page.locator('.teacher-progress-panel .progress-count')).toContainText('1 / 5');
  await page.locator('.teacher-progress-panel .btn-danger').click();
  await page.getByRole('button', { name: '기록 지우기' }).click();
  await expect(page.locator('.teacher-progress-panel .progress-count')).toContainText('0 / 5');

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const raw = localStorage.getItem('waveworks.progress.v1');
        return raw ? JSON.parse(raw).state.challenge.completed : [];
      }),
    )
    .toEqual([]);
});

test('completes a pitch challenge in visuals-only mode without audio', async ({ page }) => {
  await enterApp(page);
  await page.goto('/#/teacher');
  await page.locator('label[for="toggle-visuals-only"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-audio-state', 'silent');

  await page.goto('/#/challenges');
  await unlockChallenge(page, '한 옥타브 위의 A', '한 옥타브 높아진다');
  await expect(page).toHaveURL(/#\/tone/);

  const play = page.locator('.play-toggle');
  await play.click();
  await expect(page.locator('.play-status')).toContainText(
    '시각 전용 모드로 파형을 재생하는 중입니다',
  );
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'false');

  const frequency = page.getByRole('spinbutton', { name: '주파수 숫자 입력' });
  await frequency.fill('880');
  await frequency.press('Tab');
  await page.locator('.challenge-workbench').getByRole('button', { name: '제출하고 비교' }).click();
  await expect(page.locator('.workbench-feedback')).toContainText('목표를 정확히 맞췄습니다');
  await expect(page.locator('body')).toHaveAttribute('data-audio-state', 'silent');
});

test('completes all five challenges through their rooms', async ({ page }) => {
  await enterApp(page);

  await page.goto('/#/challenges');
  await unlockChallenge(page, '한 옥타브 위의 A', '한 옥타브 높아진다');
  await page.getByRole('spinbutton', { name: '주파수 숫자 입력' }).fill('880');
  await page.getByRole('spinbutton', { name: '주파수 숫자 입력' }).press('Tab');
  await page.locator('.challenge-workbench').getByRole('button', { name: '제출하고 비교' }).click();
  await expect(page.locator('.workbench-feedback')).toContainText('목표를 정확히 맞췄습니다');

  await page.goto('/#/challenges');
  await unlockChallenge(page, '밝은 파형 찾기', '사각파');
  await page.locator('.waveform-option').filter({ hasText: '사각' }).click();
  await page.getByRole('spinbutton', { name: '주파수 숫자 입력' }).fill('220');
  await page.getByRole('spinbutton', { name: '주파수 숫자 입력' }).press('Tab');
  await page.locator('.challenge-workbench').getByRole('button', { name: '제출하고 비교' }).click();
  await expect(page.locator('.workbench-feedback')).toContainText('목표를 정확히 맞췄습니다');

  await page.goto('/#/challenges');
  await unlockChallenge(page, '따뜻한 음색 설계', '더 밝고 복잡해진다');
  await page.locator('.preset-btn').filter({ hasText: '따뜻하게' }).click();
  await page.locator('.challenge-workbench').getByRole('button', { name: '제출하고 비교' }).click();
  await expect(page.locator('.workbench-feedback')).toContainText('목표를 정확히 맞췄습니다');

  await page.goto('/#/challenges');
  await unlockChallenge(page, 'C 메이저 화음 조립', '0 · 4 · 7 반음');
  await page.getByRole('combobox', { name: '화음 근음' }).selectOption('60');
  await page.locator('.challenge-workbench').getByRole('button', { name: '제출하고 비교' }).click();
  await expect(page.locator('.workbench-feedback')).toContainText('목표를 정확히 맞췄습니다');

  await page.goto('/#/challenges');
  await unlockChallenge(page, '8분음표 리듬 완성', '빨라진다');
  await page.getByRole('combobox', { name: '3번째 칸 음' }).selectOption('60');
  await page.getByRole('combobox', { name: '5번째 칸 음' }).selectOption('64');
  await page.getByRole('combobox', { name: '7번째 칸 음' }).selectOption('67');
  await page.locator('.challenge-workbench').getByRole('button', { name: '제출하고 비교' }).click();
  await expect(page.locator('.workbench-feedback')).toContainText('목표를 정확히 맞췄습니다');

  await page.goto('/#/challenges');
  await expect(page.locator('.progress-count').first()).toContainText('5 / 5');
  await expect(page.locator('.challenge-card.is-complete')).toHaveCount(5);
});

test('disables pulse animation for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enterApp(page);
  await page.goto('/#/challenges');
  const pulse = page.locator('.btn-pulse').first();
  await expect(pulse).toBeVisible();
  const animationName = await pulse.evaluate((element) => getComputedStyle(element).animationName);
  expect(animationName).toBe('none');
});

test('turning visuals-only off pauses visual playback', async ({ page }) => {
  await enterApp(page);
  await page.goto('/#/teacher');
  await page.locator('label[for="toggle-visuals-only"]').click();
  await page.goto('/#/tone');
  const play = page.locator('.play-toggle');
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'true');

  await page.locator('.settings-btn').click();
  await page.locator('.modal .switch-row').first().click();
  await expect(page.locator('body')).not.toHaveAttribute('data-audio-state', 'silent');
  await page.locator('.modal .btn-primary').click();

  await expect(play).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.play-status')).not.toContainText('시각 전용 모드로');
});

test('completes a challenge using only keyboard focus and keys', async ({ page }) => {
  await enterApp(page);
  await page.goto('/#/challenges');

  const radio = page.getByRole('radio', { name: '한 옥타브 높아진다' });
  await radio.focus();
  await page.keyboard.press('Space');
  await expect(radio).toBeChecked();

  const confirm = page.locator('#predict-pitch-octave');
  await confirm.focus();
  await page.keyboard.press('Enter');

  const open = page.locator('#open-pitch-octave');
  await open.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/tone/);

  const frequency = page.getByRole('spinbutton', { name: '주파수 숫자 입력' });
  await frequency.focus();
  await page.keyboard.press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+A`);
  await page.keyboard.type('880');
  await page.keyboard.press('Tab');

  const submit = page.locator('.challenge-workbench .btn-primary');
  await submit.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.workbench-feedback')).toContainText('목표를 정확히 맞췄습니다');
});

test('keyboard shortcuts play chords', async ({ page }) => {
  await enterApp(page);
  await page.goto('/#/chords');
  await expect(page.locator('.chord-name')).toHaveText('G 메이저');
  await page.keyboard.press('d');
  await expect(page.locator('.chord-name')).toHaveText('E 메이저');
  await expect(page.getByRole('combobox', { name: '화음 근음' })).toHaveValue('64');
});

test('has no serious or critical axe violations', async ({ page }) => {
  await enterApp(page);
  const toneResults = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const toneViolations = toneResults.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
  expect(toneViolations).toEqual([]);

  await page.goto('/#/challenges');
  const challengeResults = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const challengeViolations = challengeResults.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
  expect(challengeViolations).toEqual([]);
});

test('phone layout does not overflow horizontally', async ({ page }) => {
  await enterApp(page);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['tone', 'harmonics', 'chords', 'rhythm', 'challenges', 'teacher']) {
    await page.goto(`/#/${route}`);
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(hasOverflow, `${route} should not overflow`).toBe(false);
  }
});
