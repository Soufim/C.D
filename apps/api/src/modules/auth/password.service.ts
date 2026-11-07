import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/** Argon2id with OWASP-recommended parameters (m=19 MiB, t=2, p=1). */
@Injectable()
export class PasswordService {
  private readonly opts = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;
  // A real hash used to keep login timing constant for unknown accounts.
  private dummyHash: Promise<string> = hash('timing-equaliser-not-a-password', this.opts);

  hash(password: string): Promise<string> {
    return hash(password, this.opts);
  }

  async verify(passwordHash: string | null | undefined, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash ?? (await this.dummyHash), password);
    } catch {
      return false;
    }
  }
}
