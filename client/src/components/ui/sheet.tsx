import { XIcon } from 'lucide-react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import type * as React from 'react';

import { cn } from '@/lib/utils';

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
	return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
	return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
	return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetContent({
	className,
	children,
	showCloseButton = true,
	...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { showCloseButton?: boolean }) {
	return (
		<SheetPortal>
			<SheetPrimitive.Content
				data-slot="sheet-content"
				className={cn(
					'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right fixed inset-y-0 right-0 z-40 flex h-full w-full flex-col border-l shadow-2xl duration-200 sm:max-w-2xl',
					className
				)}
				{...props}
			>
				{children}
				{showCloseButton ? (
					<SheetPrimitive.Close
						data-slot="sheet-close"
						className="focus-visible:ring-ring absolute top-3 right-3 inline-flex size-9 items-center justify-center border border-b-2 opacity-80 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:outline-hidden sm:size-7 [&_svg]:size-4"
					>
						<XIcon />
						<span className="sr-only">Close</span>
					</SheetPrimitive.Close>
				) : null}
			</SheetPrimitive.Content>
		</SheetPortal>
	);
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
	return (
		<SheetPrimitive.Title
			data-slot="sheet-title"
			className={cn('type-wide text-lg leading-none font-black', className)}
			{...props}
		/>
	);
}

function SheetDescription({
	className,
	...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
	return (
		<SheetPrimitive.Description
			data-slot="sheet-description"
			className={cn('text-muted-foreground text-sm', className)}
			{...props}
		/>
	);
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle };
