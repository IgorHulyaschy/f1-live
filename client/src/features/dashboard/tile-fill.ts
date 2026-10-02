import * as React from 'react';

/**
 * True inside a dashboard tile with a fixed height. Panels that draw charts use it to fill the
 * tile instead of taking their own height.
 */
export const TileFillContext = React.createContext(false);

export function useTileFill(): boolean {
	return React.useContext(TileFillContext);
}
