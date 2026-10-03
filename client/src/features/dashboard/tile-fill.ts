import * as React from 'react';

/**
 * True inside a dashboard tile with a fixed height. Panels that draw charts use it to fill the
 * tile instead of taking their own height.
 */
export const TileFillContext = React.createContext(false);

export function useTileFill(): boolean {
	return React.useContext(TileFillContext);
}

/** The tile's height in grid rows on its dashboard; null for a tile in its own window. */
export const TileRowsContext = React.createContext<number | null>(null);

export function useTileRows(): number | null {
	return React.useContext(TileRowsContext);
}
