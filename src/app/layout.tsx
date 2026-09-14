import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Logscope — просмотр логов и трейсов",
	description:
		"Сервис сбора и просмотра логов и трейсов клиентского приложения",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="ru">
			<body>{children}</body>
		</html>
	);
}
