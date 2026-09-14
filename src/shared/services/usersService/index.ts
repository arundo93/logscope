import bcrypt from "bcryptjs";
import { prisma } from "@/shared/lib/prisma";

const BCRYPT_ROUNDS = 12;

/**
 * Сервис работы с таблицей users.
 *
 * В БД хранится ТОЛЬКО bcrypt-хеш ключа доступа (accessKeyHash), сам ключ
 * не хранится. При первом запуске ключ берётся из ACCESS_KEY в .env, хешируется,
 * создаётся пользователь, и ACCESS_KEY удаляется из .env.
 */
export class UsersService {
	/** Хеширует ключ доступа (bcrypt). */
	async hashAccessKey(accessKey: string): Promise<string> {
		return bcrypt.hash(accessKey, BCRYPT_ROUNDS);
	}

	/** Проверяет ключ доступа против bcrypt-хеша. */
	async verifyAccessKey(accessKey: string, hash: string): Promise<boolean> {
		return bcrypt.compare(accessKey, hash);
	}

	/**
	 * Ищет пользователя по ключу доступа. bcrypt-хеши уникальны, поэтому
	 * перебираем всех пользователей и сравниваем ключ с каждым хешем.
	 * Возвращает { id } или null.
	 */
	async findByAccessKey(accessKey: string): Promise<{ id: string } | null> {
		const users = await prisma.user.findMany({
			select: { id: true, accessKeyHash: true },
		});

		for (const user of users) {
			if (await this.verifyAccessKey(accessKey, user.accessKeyHash)) {
				return { id: user.id };
			}
		}

		return null;
	}

	/** Первый пользователь (для bootstrap). */
	async findFirst() {
		return prisma.user.findFirst();
	}

	/** Создаёт пользователя. */
	async create(data: { accessKeyHash: string }) {
		return prisma.user.create({ data });
	}

	/**
	 * Инициализирует первого пользователя из ACCESS_KEY в .env.
	 * Возвращает true, если пользователь был создан.
	 */
	async bootstrapFromEnv(): Promise<boolean> {
		const accessKey = process.env.ACCESS_KEY;
		if (!accessKey) return false;

		const existing = await this.findFirst();
		if (existing) return false;

		try {
			const accessKeyHash = await this.hashAccessKey(accessKey);
			await this.create({ accessKeyHash });
		} catch {
			// Конкурентное создание или ошибка БД — не блокируем вход.
			return false;
		}
		return true;
	}
}
