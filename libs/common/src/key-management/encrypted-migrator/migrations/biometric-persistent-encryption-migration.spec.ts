import { mock } from "jest-mock-extended";
import { of } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { BiometricStateService, BiometricsService, KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { LogService } from "@bitwarden/logging";
import { CryptoClient } from "@bitwarden/sdk-internal";

import { Utils } from "../../../platform/misc/utils";
import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import {
  BiometricEnrollmentChoice,
  BiometricEnrollmentPromptService,
} from "../biometric-enrollment-prompt.service";

import { BiometricPersistentMigration } from "./biometric-persistent-encryption-migration";

// Mock the SDK CryptoClient
jest.mock("@bitwarden/sdk-internal", () => ({
  CryptoClient: {
    get_key_id_for_symmetric_key: jest.fn(),
  },
}));

jest.mock("@bitwarden/common/platform/abstractions/sdk/sdk-load.service", () => ({
  SdkLoadService: { Ready: Promise.resolve() },
}));

describe("BiometricPersistentMigration", () => {
  const mockKeyService = mock<KeyService>();
  const mockBiometricsService = mock<BiometricsService>();
  const mockBiometricStateService = mock<BiometricStateService>();
  const mockLogService = mock<LogService>();
  const mockPromptService = mock<BiometricEnrollmentPromptService>();

  let sut: BiometricPersistentMigration;

  const mockUserId = "00000000-0000-0000-0000-000000000000" as UserId;
  const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
  const mockKeyId = new Uint8Array([1, 2, 3, 4]);
  const mockKeyIdHex = Utils.fromArrayToHex(mockKeyId);

  beforeEach(() => {
    jest.clearAllMocks();

    sut = new BiometricPersistentMigration(
      mockKeyService,
      mockBiometricsService,
      mockBiometricStateService,
      mockLogService,
      mockPromptService,
    );
  });

  describe("needsMigration", () => {
    it("should return 'noMigrationNeeded' when biometric unlock is not enabled", async () => {
      mockBiometricStateService.biometricUnlockEnabled$.mockReturnValue(of(false));

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
    });

    it("should return 'needsMigration' when enrolled key ID does not match current key ID", async () => {
      mockBiometricStateService.biometricUnlockEnabled$.mockReturnValue(of(true));
      mockBiometricsService.hasPersistentKey.mockResolvedValue(true);
      mockKeyService.userKey$.mockReturnValue(of(mockUserKey));
      ((CryptoClient as any).get_key_id_for_symmetric_key as jest.Mock).mockReturnValue(mockKeyId);
      mockBiometricStateService.getBiometricEnrolledKeyId.mockResolvedValue("differentKeyId");

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("needsMigration");
    });

    it("should return 'needsMigration' when the user key has a key ID but none is enrolled", async () => {
      mockBiometricStateService.biometricUnlockEnabled$.mockReturnValue(of(true));
      mockBiometricsService.hasPersistentKey.mockResolvedValue(true);
      mockKeyService.userKey$.mockReturnValue(of(mockUserKey));
      ((CryptoClient as any).get_key_id_for_symmetric_key as jest.Mock).mockReturnValue(mockKeyId);
      mockBiometricStateService.getBiometricEnrolledKeyId.mockResolvedValue(null);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("needsMigration");
    });

    it("should return 'needsMigration' when a key ID is enrolled but the user key has none", async () => {
      mockBiometricStateService.biometricUnlockEnabled$.mockReturnValue(of(true));
      mockBiometricsService.hasPersistentKey.mockResolvedValue(true);
      mockKeyService.userKey$.mockReturnValue(of(mockUserKey));
      ((CryptoClient as any).get_key_id_for_symmetric_key as jest.Mock).mockReturnValue(undefined);
      mockBiometricStateService.getBiometricEnrolledKeyId.mockResolvedValue(mockKeyIdHex);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("needsMigration");
    });

    it("should return 'noMigrationNeeded' when neither the user key nor the enrollment has a key ID", async () => {
      mockBiometricStateService.biometricUnlockEnabled$.mockReturnValue(of(true));
      mockBiometricsService.hasPersistentKey.mockResolvedValue(true);
      mockKeyService.userKey$.mockReturnValue(of(mockUserKey));
      ((CryptoClient as any).get_key_id_for_symmetric_key as jest.Mock).mockReturnValue(undefined);
      mockBiometricStateService.getBiometricEnrolledKeyId.mockResolvedValue(null);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
    });

    it("should return 'noMigrationNeeded' when enrolled key ID matches current key ID", async () => {
      mockBiometricStateService.biometricUnlockEnabled$.mockReturnValue(of(true));
      mockBiometricsService.hasPersistentKey.mockResolvedValue(true);
      mockKeyService.userKey$.mockReturnValue(of(mockUserKey));
      ((CryptoClient as any).get_key_id_for_symmetric_key as jest.Mock).mockReturnValue(mockKeyId);
      mockBiometricStateService.getBiometricEnrolledKeyId.mockResolvedValue(mockKeyIdHex);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
    });

    it("should return 'noMigrationNeeded' when no persistent key exists", async () => {
      mockBiometricStateService.biometricUnlockEnabled$.mockReturnValue(of(true));
      mockBiometricsService.hasPersistentKey.mockResolvedValue(false);

      const result = await sut.needsMigration(mockUserId);

      expect(result).toBe("noMigrationNeeded");
    });
  });

  describe("runMigrations", () => {
    it("should re-enroll persistent and ephemeral key on every migration", async () => {
      mockKeyService.userKey$.mockReturnValue(of(mockUserKey));
      mockBiometricsService.hasPersistentKey.mockResolvedValue(false);

      await sut.runMigrations(mockUserId, null);

      expect(mockBiometricsService.enrollPersistent).toHaveBeenCalledWith(mockUserId, mockUserKey);
      expect(mockBiometricsService.setBiometricProtectedUnlockKeyForUser).toHaveBeenCalledWith(
        mockUserId,
        mockUserKey,
      );
    });

    describe("when enrollment fails", () => {
      const enrollmentError = new Error("Windows Hello cancelled");

      beforeEach(() => {
        mockKeyService.userKey$.mockReturnValue(of(mockUserKey));
        mockBiometricsService.enrollPersistent.mockReset();
      });

      it("retries enrollment when the user authorizes and the authorization fails", async () => {
        mockBiometricsService.enrollPersistent
          .mockRejectedValueOnce(enrollmentError)
          .mockResolvedValueOnce();
        mockPromptService.promptRetry.mockResolvedValue(BiometricEnrollmentChoice.Authorize);

        await sut.runMigrations(mockUserId, null);

        expect(mockBiometricsService.enrollPersistent).toHaveBeenCalledTimes(2);
        expect(mockBiometricsService.setBiometricProtectedUnlockKeyForUser).toHaveBeenCalledWith(
          mockUserId,
          mockUserKey,
        );
        expect(mockBiometricStateService.setBiometricUnlockEnabled).not.toHaveBeenCalled();
      });

      it("disables biometric unlock when the user chooses to", async () => {
        mockBiometricsService.enrollPersistent.mockRejectedValue(enrollmentError);
        mockPromptService.promptRetry.mockResolvedValue(BiometricEnrollmentChoice.Disable);

        await sut.runMigrations(mockUserId, null);

        expect(mockBiometricStateService.setBiometricUnlockEnabled).toHaveBeenCalledWith(
          false,
          mockUserId,
        );
        expect(mockBiometricsService.deleteBiometricUnlockKeyForUser).toHaveBeenCalledWith(
          mockUserId,
        );
        expect(mockBiometricsService.setBiometricProtectedUnlockKeyForUser).not.toHaveBeenCalled();
      });

      it("leaves biometric unlock enabled when the prompt closes without a choice", async () => {
        mockBiometricsService.enrollPersistent.mockRejectedValue(enrollmentError);
        mockPromptService.promptRetry.mockRejectedValue(new Error("Closed by vault lock"));

        await expect(sut.runMigrations(mockUserId, null)).rejects.toThrow();

        expect(mockBiometricStateService.setBiometricUnlockEnabled).not.toHaveBeenCalled();
        expect(mockBiometricsService.deleteBiometricUnlockKeyForUser).not.toHaveBeenCalled();
      });
    });
  });
});
