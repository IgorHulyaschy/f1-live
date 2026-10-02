import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster({ theme = 'dark', ...props }: ToasterProps) {
	return <Sonner theme={theme} {...props} />;
}

export { Toaster };
