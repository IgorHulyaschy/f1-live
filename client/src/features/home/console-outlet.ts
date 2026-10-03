import { useOutletContext } from 'react-router';

/** What the app's frame hands the page inside it. */
export type ConsoleOutlet = { openCommand: () => void };

export function useOpenCommand(): () => void {
	return useOutletContext<ConsoleOutlet>().openCommand;
}
