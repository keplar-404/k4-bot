"use client";

// Last-resort error page for React render errors in the App Router.
import NextError from "next/error";

export default function GlobalError() {
	return (
		<html lang="en">
			<body>
				{/* The App Router exposes no status code here, so 0 shows a generic message. */}
				<NextError statusCode={0} />
			</body>
		</html>
	);
}
