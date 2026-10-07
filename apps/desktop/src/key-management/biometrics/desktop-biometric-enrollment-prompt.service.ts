import { firstValueFrom } from "rxjs";

import {
  BiometricEnrollmentChoice,
  BiometricEnrollmentPromptService,
} from "@bitwarden/common/key-management/encrypted-migrator/biometric-enrollment-prompt.service";
import { DialogService } from "@bitwarden/components";

/**
 * Asks the user to retry a failed biometric enrollment or turn biometric unlock off. The dialog
 * cannot be dismissed, so the choice is explicit.
 */
export class DesktopBiometricEnrollmentPromptService implements BiometricEnrollmentPromptService {
  constructor(private readonly dialogService: DialogService) {}

  async promptRetry(): Promise<BiometricEnrollmentChoice> {
    // With disableClose set, the simple dialog's accept button no longer closes the dialog, so
    // acceptAction closes it explicitly.
    const dialogRef = this.dialogService.openSimpleDialogRef({
      title: { key: "biometricEnrollmentFailedTitle" },
      content: { key: "biometricEnrollmentFailedDesc" },
      type: "warning",
      acceptButtonText: { key: "authorize" },
      cancelButtonText: { key: "turnOff" },
      disableClose: true,
      acceptAction: async () => {
        await dialogRef.close(true);
      },
    });

    const authorize = await firstValueFrom(dialogRef.closed);

    // Closed by lock or logout, not by the user. Throw so biometric state stays untouched and
    // the migration prompts again on its next run.
    if (authorize === undefined) {
      throw new Error("Biometric enrollment prompt closed without a choice");
    }

    return authorize ? BiometricEnrollmentChoice.Authorize : BiometricEnrollmentChoice.Disable;
  }
}
