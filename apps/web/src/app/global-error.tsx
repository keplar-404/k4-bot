"use client";

// Last-resort error page for React render errors in the App Router; reports them to Sentry.
import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
	error,
}: {
	error: Error & { digest?: string };
}) {
	useEffect(() => {
		Sentry.captureException(error);
	}, [error]);

	return (
		<html lang="en">
			<body>
				{/* The App Router exposes no status code here, so 0 shows a generic message. */}
				<NextError statusCode={0} />
			</body>
		</html>
	);
}
