import { describe, expect, it } from "bun:test";
import { loadSliceContract, validateSliceContractObject, validateSliceExecution, type SliceExecutionEvidence } from "@/lib/xclips/slice-contract";

const baseEvidence = (): SliceExecutionEvidence => ({
  projectId: "proj_1788933823612_gftf",
  sourceVideoId: "vXFdaRBI9ls",
  semanticStatementId: "s1-editorial-statement-001",
  semanticAnchor: "Reaksi terhadap kebakaran hutan kita juga cukup masif ... kita gunakan prinsip lebih baik-lebih daripada kurang",
  physicalStatementStart: 149.56,
  physicalStatementEnd: 197,
  headline: "Reaksi terhadap Kebakaran Hutan Cukup Masif",
  publisher: "METRO TV",
  visualSpine: "S1 frozen: red vertical headline bar, neutral canvas, 52px/12px headline, raised footer",
  momentRediscoveryCalls: 0,
  headlineGenerationCalls: 0,
  ccTimingUsedForPhysicalCuts: false,
  fillerFlagsUsedForPhysicalCuts: false,
  trustedAudioAlignmentStatus: "PASS",
  bgmUsed: false,
  sfxUsed: false,
  brollUsed: false,
  hyperframesUsed: false,
  visualRedesignUsed: false,
  thumbnailRedesignUsed: false,
  nextSliceWorkStarted: false,
  machineGateStatus: "PASS",
  humanGateStatus: "PASS",
});

function validate(overrides: Partial<SliceExecutionEvidence> = {}) {
  return validateSliceExecution(loadSliceContract("s2"), { ...baseEvidence(), ...overrides });
}

describe("S2 hard slice contract", () => {
  it("1. exact frozen state passes and closes", () => {
    const result = validate();
    expect(result.hardInvariantFailed).toBe(false);
    expect(result.humanReviewAllowed).toBe(true);
    expect(result.closureAllowed).toBe(true);
  });

  it("2-5. immutable identity changes fail", () => {
    for (const overrides of [
      { semanticStatementId: "other" },
      { semanticAnchor: "other" },
      { headline: "Changed headline" },
      { publisher: "Other publisher" },
      { projectId: "other-project" },
      { visualSpine: "changed visual" },
    ]) {
      const result = validate(overrides);
      expect(result.hardInvariantFailed).toBe(true);
      expect(result.checks.find((check) => check.id === "immutable_identity")?.status).toBe("FAIL");
    }
  });

  it("6-7. rediscovery and headline regeneration fail", () => {
    expect(validate({ momentRediscoveryCalls: 1 }).hardInvariantFailed).toBe(true);
    expect(validate({ headlineGenerationCalls: 1 }).hardInvariantFailed).toBe(true);
  });

  it("8. CC timing physical cuts fail", () => {
    const result = validate({ ccTimingUsedForPhysicalCuts: true });
    expect(result.checks.find((check) => check.id === "cc_physical_cut_truth")?.status).toBe("FAIL");
  });

  it("9. filler cuts with blocked alignment fail", () => {
    const result = validate({ fillerFlagsUsedForPhysicalCuts: true, trustedAudioAlignmentStatus: "BLOCKED" });
    expect(result.hardInvariantFailed).toBe(true);
    expect(result.checks.find((check) => check.id === "filler_physical_cut_truth")?.status).toBe("FAIL");
  });

  it("10. filler cuts with trusted alignment pass that invariant", () => {
    const result = validate({ fillerFlagsUsedForPhysicalCuts: true, trustedAudioAlignmentStatus: "PASS" });
    expect(result.checks.find((check) => check.id === "filler_physical_cut_truth")?.status).toBe("PASS");
  });

  it("11. BLOCKED alignment remains BLOCKED and cannot close", () => {
    const result = validate({ trustedAudioAlignmentStatus: "BLOCKED", machineGateStatus: "PASS", humanGateStatus: "PENDING" });
    expect(result.checks.find((check) => check.id === "trusted_audio_alignment")?.status).toBe("BLOCKED");
    expect(result.humanReviewAllowed).toBe(true);
    expect(result.closureAllowed).toBe(false);
  });

  it("12-13. human gate separates review from closure", () => {
    expect(validate({ humanGateStatus: "PENDING" }).closureAllowed).toBe(false);
    expect(validate().closureAllowed).toBe(true);
  });

  it("accepts trusted physical correction while semantic identity stays frozen", () => {
    const result = validate({ physicalStatementStart: 147.99, physicalStatementEnd: 192.3, trustedAudioAlignmentStatus: "PASS", semanticStatementPreserved: true });
    expect(result.hardInvariantFailed).toBe(false);
    expect(result.checks.find((check) => check.id === "physical_boundary_authorization")?.status).toBe("PASS");
  });

  it("rejects physical correction without trusted alignment or semantic preservation", () => {
    expect(validate({ physicalStatementStart: 147.99, physicalStatementEnd: 192.3, trustedAudioAlignmentStatus: "BLOCKED", semanticStatementPreserved: true }).hardInvariantFailed).toBe(true);
    expect(validate({ physicalStatementStart: 147.99, physicalStatementEnd: 192.3, trustedAudioAlignmentStatus: "PASS", semanticStatementPreserved: false }).hardInvariantFailed).toBe(true);
  });

  it("14-16. forbidden capabilities fail", () => {
    for (const key of ["bgmUsed", "sfxUsed", "brollUsed", "hyperframesUsed", "nextSliceWorkStarted"] as const) {
      expect(validate({ [key]: true } as Partial<SliceExecutionEvidence>).hardInvariantFailed).toBe(true);
    }
  });

  it("17. different mutable keep intervals do not change immutable identity", () => {
    const one = validate({ keepIntervals: [{ start: 0, end: 47.44, duration: 47.44 }] });
    const two = validate({ keepIntervals: [{ start: 0, end: 20, duration: 20 }, { start: 22, end: 47.44, duration: 25.44 }] });
    expect(one.checks.find((check) => check.id === "immutable_identity")?.status).toBe("PASS");
    expect(two.checks.find((check) => check.id === "immutable_identity")?.status).toBe("PASS");
  });

  it("loads valid contract and rejects unsupported structure", () => {
    expect(loadSliceContract("s2").slice).toBe("S2");
    const contract = loadSliceContract("s2");
    expect(() => validateSliceContractObject({ ...contract, immutableDimensions: contract.immutableDimensions.filter((item) => item !== "semanticStatementId") })).toThrow();
    expect(() => validateSliceContractObject({ ...contract, immutableDimensions: [...contract.immutableDimensions, "projectId"] })).toThrow();
    expect(() => validateSliceContractObject({ ...contract, forbiddenCapabilities: contract.forbiddenCapabilities.filter((item) => item !== "bgm") })).toThrow();
    expect(() => validateSliceContractObject({ ...contract, forbiddenCapabilities: [...contract.forbiddenCapabilities, "unknown"] })).toThrow();
    expect(() => validateSliceContractObject({ ...contract, evidenceVocabulary: ["PASS"] })).toThrow();
    expect(() => validateSliceContractObject({ ...contract, closure: { machineGateRequired: false, humanGateRequired: true, blockedRequiredEvidenceMayClose: false } })).toThrow();
    expect(() => validateSliceContractObject({ ...contract, hardInvariants: { ...contract.hardInvariants, ccTimingMayDrivePhysicalCuts: true } })).toThrow();
    expect(() => validateSliceContractObject({ ...contract, hardInvariants: { ...contract.hardInvariants, momentRediscoveryCalls: 1 } })).toThrow();
    const { ccTimingMayDrivePhysicalCuts: _removed, ...missingInvariant } = contract.hardInvariants;
    expect(() => validateSliceContractObject({ ...contract, hardInvariants: missingInvariant })).toThrow();
    expect(() => validateSliceContractObject({ ...contract, hardInvariants: { ...contract.hardInvariants, unsupported: false } })).toThrow();
  });

  it("rejects the previous bad S2 attempt with multiple failures", () => {
    const result = validate({
      physicalStatementStart: 103,
      physicalStatementEnd: 149.56,
      headline: "Kita Pulihkan Aceh, Sumut, dan Sumbar dengan Kekuatan Sendiri",
      momentRediscoveryCalls: 1,
      ccTimingUsedForPhysicalCuts: true,
      fillerFlagsUsedForPhysicalCuts: true,
      trustedAudioAlignmentStatus: "BLOCKED",
      semanticStatementPreserved: false,
    });
    expect(result.hardInvariantFailed).toBe(true);
    expect(result.checks.filter((check) => check.status === "FAIL").length).toBeGreaterThanOrEqual(4);
    expect(result.checks.find((check) => check.id === "trusted_audio_alignment")?.status).toBe("BLOCKED");
    expect(result.closureAllowed).toBe(false);
  });
});
