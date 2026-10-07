/** The user's choice after a failed biometric enrollment. */
export const BiometricEnrollmentChoice = Object.freeze({
  /** Show the OS biometric prompt again. */
  Authorize: "authorize",
  /** Turn biometric unlock off. */
  Disable: "disable",
} as const);
export type BiometricEnrollmentChoice =
  (typeof BiometricEnrollmentChoice)[keyof typeof BiometricEnrollmentChoice];

/**
 * Asks the user how to proceed when re-enrolling biometric unlock fails, e.g. because the
 * Windows Hello prompt was cancelled.
 */
export abstract class BiometricEnrollmentPromptService {
  /**
   * Resolves once the user picked an option. The prompt cannot be dismissed.
   * @throws If the prompt closed without a choice, e.g. because the vault locked.
   */
  abstract promptRetry(): Promise<BiometricEnrollmentChoice>;
}
