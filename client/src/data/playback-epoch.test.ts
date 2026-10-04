import assert from 'node:assert/strict';
import test from 'node:test';

import { INITIAL_EPOCH, nextEpoch, receivePlayback } from './playback-epoch.ts';

const play = nextEpoch(INITIAL_EPOCH, 'a');

const pause = nextEpoch(play, 'b');

test('a step from the play being followed applies', () => {
	assert.equal(receivePlayback(play, { epoch: play, tick: true }, true).apply, true);
});

test('a step sent before the last pause is dropped, even while still following', () => {
	assert.equal(receivePlayback(pause, { epoch: play, tick: true }, true).apply, false);
});

test('a paused window applies no steps', () => {
	assert.equal(receivePlayback(play, { epoch: play, tick: true }, false).apply, false);
});

test('a step without an epoch is dropped', () => {
	assert.equal(receivePlayback(play, { tick: true }, true).apply, false);
});

test('a newer play or pause applies and becomes the last epoch', () => {
	assert.deepEqual(receivePlayback(play, { epoch: pause, playing: false }, true), {
		apply: true,
		last: pause
	});
});

test('an older play or pause is dropped', () => {
	assert.deepEqual(receivePlayback(pause, { epoch: play, playing: true }, false), {
		apply: false,
		last: pause
	});
});

test('two windows acting at once settle on the same one: the higher sender wins the tie', () => {
	const fromA = nextEpoch(INITIAL_EPOCH, 'a');
	const fromB = nextEpoch(INITIAL_EPOCH, 'b');

	assert.equal(receivePlayback(fromB, { epoch: fromA, playing: true }, false).apply, false);
	assert.equal(receivePlayback(fromA, { epoch: fromB, playing: false }, false).apply, true);
});

test('a repeat of the same epoch applies, so a hello answer is harmless', () => {
	assert.equal(receivePlayback(play, { epoch: play, playing: true }, true).apply, true);
});

test('a message that is not about playback applies as before', () => {
	assert.equal(receivePlayback(pause, {}, false).apply, true);
});
