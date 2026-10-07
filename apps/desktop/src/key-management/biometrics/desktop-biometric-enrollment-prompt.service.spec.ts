import { mock } from "jest-mock-extended";
import { Subject } from "rxjs";

import { BiometricEnrollmentChoice } from "@bitwarden/common/key-management/encrypted-migrator/biometric-enrollment-prompt.service";
import { DialogRef, DialogService, SimpleDialogOptions } from "@bitwarden/components";

import { DesktopBiometricEnrollmentPromptService } from "./desktop-biometric-enrollment-prompt.service";

describe("DesktopBiometricEnrollmentPromptService", () => {
  const dialogService = mock<DialogService>();
  let closed: Subject<boolean | undefined>;
  let dialogRef: DialogRef<boolean>;
  let sut: DesktopBiometricEnrollmentPromptService;

  beforeEach(() => {
    jest.clearAllMocks();

    closed = new Subject();
    dialogRef = {
      closed: closed.asObservable(),
      close: jest.fn(async (result?: boolean) => {
        closed.next(result);
        closed.complete();
      }),
    } as unknown as DialogRef<boolean>;
    dialogService.openSimpleDialogRef.mockReturnValue(dialogRef);

    sut = new DesktopBiometricEnrollmentPromptService(dialogService);
  });

  function dialogOptions(): SimpleDialogOptions {
    return dialogService.openSimpleDialogRef.mock.calls[0][0];
  }

  // Mirrors SimpleConfigurableDialogComponent.accept: with disableClose set, only acceptAction
  // can close the dialog.
  async function clickAccept() {
    const options = dialogOptions();
    await options.acceptAction?.();
    if (!options.disableClose) {
      await dialogRef.close(true);
    }
  }

  // The user must pick an option; dismissing would leave the migration to re-prompt endlessly.
  it("opens a dialog that cannot be dismissed", () => {
    void sut.promptRetry();

    expect(dialogOptions()).toEqual(
      expect.objectContaining({
        acceptButtonText: { key: "authorize" },
        cancelButtonText: { key: "turnOff" },
        disableClose: true,
      }),
    );
  });

  it("returns Authorize when the user accepts", async () => {
    const choice = sut.promptRetry();

    await clickAccept();

    await expect(choice).resolves.toBe(BiometricEnrollmentChoice.Authorize);
  });

  it("returns Disable when the user turns biometric unlock off", async () => {
    const choice = sut.promptRetry();

    await dialogRef.close(false);

    await expect(choice).resolves.toBe(BiometricEnrollmentChoice.Disable);
  });

  // Lock and logout close all dialogs. That is not the user's choice, so biometric unlock must
  // stay enabled and the migration must prompt again on its next run.
  it("rejects when the dialog is closed without a choice", async () => {
    const choice = sut.promptRetry();

    await dialogRef.close();

    await expect(choice).rejects.toThrow();
  });
});
