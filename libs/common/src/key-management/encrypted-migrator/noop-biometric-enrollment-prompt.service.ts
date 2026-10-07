import {
  BiometricEnrollmentChoice,
  BiometricEnrollmentPromptService,
} from "./biometric-enrollment-prompt.service";

/**
 * Default implementation for clients without persistent biometric enrollment (browser
 * extension, web, CLI).
 */
export class NoopBiometricEnrollmentPromptService implements BiometricEnrollmentPromptService {
  async promptRetry(): Promise<BiometricEnrollmentChoice> {
    throw new Error("Biometric enrollment prompt is not supported on this client");
  }
}
