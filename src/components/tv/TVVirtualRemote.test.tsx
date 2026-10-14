import { fireEvent, render } from '@testing-library/react';
import React from 'react';

import TVVirtualRemote from './TVVirtualRemote';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/tv',
}));

test.each([
  [
    { key: 'ArrowRight' },
    { key: 'ArrowLeft' },
    { key: 'ArrowDown' },
    { key: 'ArrowUp' },
  ],
  [{ key: 'Right' }, { key: 'Left' }, { key: 'Down' }, { key: 'Up' }],
  [
    { key: 'Unidentified', keyCode: 39 },
    { key: 'Unidentified', keyCode: 37 },
    { key: '', keyCode: 40 },
    { key: '', keyCode: 38 },
  ],
])(
  'moves focus in all four directions for modern/legacy key events',
  (right, left, down, up) => {
    const rect = jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const x = Number(this.dataset.x || 0),
          y = Number(this.dataset.y || 0);
        return {
          x,
          y,
          left: x,
          top: y,
          right: x + 80,
          bottom: y + 60,
          width: 80,
          height: 60,
          toJSON: () => ({}),
        };
      });
    HTMLElement.prototype.scrollIntoView = jest.fn();
    const view = render(
      <>
        <header>
          <a href='/tv' data-x='0'>
            主页
          </a>
          <a href='/tv/movie' data-x='100'>
            电影
          </a>
        </header>
        <button data-y='200'>影片</button>
        <TVVirtualRemote />
      </>
    );
    const home = view.getByText('主页'),
      movie = view.getByText('电影'),
      card = view.getByText('影片');
    home.focus();
    fireEvent.keyDown(window, right);
    expect(movie).toHaveFocus();
    fireEvent.keyDown(window, left);
    expect(home).toHaveFocus();
    fireEvent.keyDown(window, down);
    expect(card).toHaveFocus();
    fireEvent.keyDown(window, up);
    expect(home).toHaveFocus();
    rect.mockRestore();
  }
);
