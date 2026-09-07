"use client";

import {
	CheckCircle as CheckCircleIcon,
	Error as ErrorIcon,
	FolderOpen as FolderOpenIcon,
	PlayArrow as PlayIcon,
	WarningAmber as WarningIcon,
} from "@mui/icons-material";
import {
	Alert,
	Box,
	Button,
	Card,
	CardContent,
	Chip,
	CircularProgress,
	Divider,
	FormControl,
	InputLabel,
	LinearProgress,
	MenuItem,
	Select,
	Tooltip,
	Typography,
} from "@mui/material";
import { useCallback, useState } from "react";
import { FormField } from "@/components/form/FormField";
import {
	type AutoProductionJobResult,
	type AutoProductionStage,
	type RerenderJobContext,
	type AccountPresetId,
	type ProductionBrief,
	detectSourceType,
	generateAutoProduction,
	rerenderAutoProduction,
	regenerateAutoProduction,
} from "@/lib/xclips/auto-production-api";

// ============================================================
// Auto Production UI — Slice 5
// ============================================================

type UiState =
	| { phase: "new_job" }
	| { phase: "processing"; stage: AutoProductionStage }
	| { phase: "result"; result: AutoProductionJobResult };

const STAGE_LABELS: Record<AutoProductionStage, string> = {
	preparing_source: "Preparing source",
	transcript_ready: "Transcript ready",
	selecting_statement: "Selecting statement",
	preparing_graphics: "Preparing graphics",
	rendering: "Rendering",
	running_qc: "Running QC",
};

export default function AutoProductionPage() {
	const [uiState, setUiState] = useState<UiState>({ phase: "new_job" });

	// Form fields
	const [sourcePath, setSourcePath] = useState("");
	const [editorialAngle, setEditorialAngle] = useState("");
	const [accountPresetId, setAccountPresetId] = useState<AccountPresetId | "">(
		"",
	);
	const [sourceName, setSourceName] = useState("");
	const [sourceDate, setSourceDate] = useState("");
	const [accountHandle, setAccountHandle] = useState("");
	const [sourceRole, setSourceRole] = useState("");

	const canGenerate =
		sourcePath.trim().length > 0 &&
		editorialAngle.trim().length > 0 &&
		accountPresetId !== "" &&
		sourceName.trim().length > 0 &&
		accountHandle.trim().length > 0;

	const buildBrief = useCallback((): ProductionBrief => {
		const sourceType = detectSourceType(sourcePath.trim());
		return {
			source: { sourcePath: sourcePath.trim(), sourceType },
			editorialAngle: editorialAngle.trim(),
			accountPresetId: accountPresetId as AccountPresetId,
			sourceName: sourceName.trim(),
			sourceDate: sourceDate.trim() || undefined,
			accountHandle: accountHandle.trim(),
			sourceRole: sourceRole.trim() || undefined,
			brollPool: [],
		};
	}, [
		sourcePath,
		editorialAngle,
		accountPresetId,
		sourceName,
		sourceDate,
		accountHandle,
		sourceRole,
	]);

	const handleGenerate = useCallback(async () => {
		if (!canGenerate) return;

		const brief = buildBrief();

		setUiState({ phase: "processing", stage: "preparing_source" });

		try {
			const result = await generateAutoProduction(brief);
			setUiState({ phase: "result", result });
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			setUiState({
				phase: "result",
				result: { status: "FAILED", stage: "preparing_source", error: msg },
			});
		}
	}, [canGenerate, buildBrief]);

	const handleRenderAgain = useCallback(async () => {
		if (uiState.phase !== "result" || uiState.result.status === "FAILED")
			return;

		const rerenderContext = uiState.result.bundle.rerenderContext;

		setUiState({ phase: "processing", stage: "preparing_graphics" });
		try {
			const result = await rerenderAutoProduction(rerenderContext);
			setUiState({ phase: "result", result });
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			setUiState({
				phase: "result",
				result: { status: "FAILED", stage: "rendering", error: msg },
			});
		}
	}, [uiState]);

	const handleRegenerate = useCallback(async () => {
		if (uiState.phase !== "result" || uiState.result.status === "FAILED")
			return;

		const rerenderContext = uiState.result.bundle.rerenderContext;

		setUiState({ phase: "processing", stage: "preparing_source" });
		try {
			const result = await regenerateAutoProduction(rerenderContext.brief);
			setUiState({ phase: "result", result });
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			setUiState({
				phase: "result",
				result: { status: "FAILED", stage: "preparing_source", error: msg },
			});
		}
	}, [uiState]);

	const handleOpenOutput = useCallback(async (filePath: string) => {
		try {
			const { openPath } = await import("@tauri-apps/plugin-opener");
			await openPath(filePath);
		} catch {
			try {
				const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
				await revealItemInDir(filePath);
			} catch {
				// Browser fallback: path is visible in UI
			}
		}
	}, []);

	const handleNewJob = useCallback(() => {
		setUiState({ phase: "new_job" });
	}, []);

	return (
		<Box sx={{ p: 3, maxWidth: 900, mx: "auto" }}>
			<Typography
				variant="h5"
				sx={{ color: "#f4f4f5", fontWeight: 800, mb: 3 }}
			>
				Auto Production
			</Typography>

			{uiState.phase === "new_job" && (
				<NewJobForm
					sourcePath={sourcePath}
					setSourcePath={setSourcePath}
					editorialAngle={editorialAngle}
					setEditorialAngle={setEditorialAngle}
					accountPresetId={accountPresetId}
					setAccountPresetId={setAccountPresetId}
					sourceName={sourceName}
					setSourceName={setSourceName}
					sourceDate={sourceDate}
					setSourceDate={setSourceDate}
					accountHandle={accountHandle}
					setAccountHandle={setAccountHandle}
					sourceRole={sourceRole}
					setSourceRole={setSourceRole}
					canGenerate={canGenerate}
					onGenerate={handleGenerate}
				/>
			)}

			{uiState.phase === "processing" && (
				<ProcessingView stage={uiState.stage} />
			)}

			{uiState.phase === "result" && (
				<ResultView
					result={uiState.result}
					onOpenOutput={handleOpenOutput}
					onRenderAgain={handleRenderAgain}
					onRegenerate={handleRegenerate}
					onNewJob={handleNewJob}
				/>
			)}
		</Box>
	);
}

// ============================================================
// New Job Form
// ============================================================

interface NewJobFormProps {
	sourcePath: string;
	setSourcePath: (v: string) => void;
	editorialAngle: string;
	setEditorialAngle: (v: string) => void;
	accountPresetId: AccountPresetId | "";
	setAccountPresetId: (v: AccountPresetId | "") => void;
	sourceName: string;
	setSourceName: (v: string) => void;
	sourceDate: string;
	setSourceDate: (v: string) => void;
	accountHandle: string;
	setAccountHandle: (v: string) => void;
	sourceRole: string;
	setSourceRole: (v: string) => void;
	canGenerate: boolean;
	onGenerate: () => void;
}

function NewJobForm({
	sourcePath,
	setSourcePath,
	editorialAngle,
	setEditorialAngle,
	accountPresetId,
	setAccountPresetId,
	sourceName,
	setSourceName,
	sourceDate,
	setSourceDate,
	accountHandle,
	setAccountHandle,
	sourceRole,
	setSourceRole,
	canGenerate,
	onGenerate,
}: NewJobFormProps) {
	return (
		<Card
			sx={{
				bgcolor: "#121215",
				border: "1px solid #27272a",
				borderRadius: 1.5,
			}}
		>
			<CardContent sx={{ p: 3 }}>
				<Typography
					variant="subtitle2"
					sx={{ color: "#a1a1aa", mb: 2, fontWeight: 700 }}
				>
					Primary Source
				</Typography>
				<FormField
					label="Source Path"
					subLabel="required"
					placeholder="/path/to/video.mp4 or YouTube URL"
					value={sourcePath}
					onChange={(e) => setSourcePath(e.target.value)}
				/>

				<Typography
					variant="subtitle2"
					sx={{ color: "#a1a1aa", mt: 3, mb: 2, fontWeight: 700 }}
				>
					Editorial
				</Typography>
				<FormField
					label="Editorial Angle"
					subLabel="required"
					placeholder="e.g. Dampak erupsi Gunung Kelud"
					value={editorialAngle}
					onChange={(e) => setEditorialAngle(e.target.value)}
				/>

				<FormControl fullWidth size="small" sx={{ mt: 2 }}>
					<InputLabel sx={{ color: "#a1a1aa" }}>Account Preset</InputLabel>
					<Select
						value={accountPresetId}
						label="Account Preset"
						onChange={(e) =>
							setAccountPresetId(e.target.value as AccountPresetId | "")
						}
						sx={{ bgcolor: "#18181b", color: "#f4f4f5", borderRadius: 1 }}
					>
						<MenuItem value="shadow">Shadow</MenuItem>
						<MenuItem value="kabakom">Kabakom</MenuItem>
					</Select>
				</FormControl>

				<Typography
					variant="subtitle2"
					sx={{ color: "#a1a1aa", mt: 3, mb: 2, fontWeight: 700 }}
				>
					Source Metadata
				</Typography>
				<Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
					<FormField
						label="Source Name"
						subLabel="required"
						placeholder="e.g. TVRI Jatim"
						value={sourceName}
						onChange={(e) => setSourceName(e.target.value)}
					/>
					<FormField
						label="Account Handle"
						subLabel="required"
						placeholder="e.g. @tvrijatim"
						value={accountHandle}
						onChange={(e) => setAccountHandle(e.target.value)}
					/>
					<FormField
						label="Source Date"
						subLabel="optional"
						placeholder="e.g. 2026-09-07"
						value={sourceDate}
						onChange={(e) => setSourceDate(e.target.value)}
					/>
					<FormField
						label="Source Role"
						subLabel="optional"
						placeholder="e.g. Reporter"
						value={sourceRole}
						onChange={(e) => setSourceRole(e.target.value)}
					/>
				</Box>

				<Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
					<Button
						variant="contained"
						disabled={!canGenerate}
						startIcon={<PlayIcon />}
						onClick={onGenerate}
						sx={{
							bgcolor: canGenerate ? "#3b82f6" : "#27272a",
							color: canGenerate ? "#fff" : "#71717a",
							fontWeight: 700,
							textTransform: "none",
							px: 3,
							borderRadius: 1,
							"&:hover": { bgcolor: canGenerate ? "#2563eb" : "#27272a" },
						}}
					>
						Generate
					</Button>
				</Box>
			</CardContent>
		</Card>
	);
}

// ============================================================
// Processing View
// ============================================================

function ProcessingView({ stage }: { stage: AutoProductionStage }) {
	const stageIndex = (
		Object.keys(STAGE_LABELS) as AutoProductionStage[]
	).indexOf(stage);
	const totalStages = Object.keys(STAGE_LABELS).length;
	const progress = ((stageIndex + 1) / totalStages) * 100;

	return (
		<Card
			sx={{
				bgcolor: "#121215",
				border: "1px solid #27272a",
				borderRadius: 1.5,
			}}
		>
			<CardContent sx={{ p: 3, textAlign: "center" }}>
				<CircularProgress size={48} sx={{ color: "#3b82f6", mb: 2 }} />
				<Typography
					variant="h6"
					sx={{ color: "#f4f4f5", fontWeight: 700, mb: 1 }}
				>
					Processing
				</Typography>
				<Typography variant="body2" sx={{ color: "#a1a1aa", mb: 2 }}>
					{STAGE_LABELS[stage]}
				</Typography>
				<LinearProgress
					variant="determinate"
					value={progress}
					sx={{
						height: 6,
						borderRadius: 3,
						bgcolor: "#27272a",
						"& .MuiLinearProgress-bar": { bgcolor: "#3b82f6", borderRadius: 3 },
					}}
				/>
			</CardContent>
		</Card>
	);
}

// ============================================================
// Result View
// ============================================================

interface ResultViewProps {
	result: AutoProductionJobResult;
	onOpenOutput: (path: string) => void;
	onRenderAgain: () => void;
	onRegenerate: () => void;
	onNewJob: () => void;
}

function ResultView({
	result,
	onOpenOutput,
	onRenderAgain,
	onRegenerate,
	onNewJob,
}: ResultViewProps) {
	const isReady = result.status === "READY";
	const isReview = result.status === "NEEDS_REVIEW";
	const isFailed = result.status === "FAILED";
	const canRerender = result.status === "READY" || result.status === "NEEDS_REVIEW";

	const StatusIcon = isReady
		? CheckCircleIcon
		: isReview
			? WarningIcon
			: ErrorIcon;
	const statusColor = isReady ? "#10b981" : isReview ? "#f59e0b" : "#ef4444";
	const statusLabel = isReady ? "READY" : isReview ? "NEEDS REVIEW" : "FAILED";

	return (
		<Card
			sx={{
				bgcolor: "#121215",
				border: "1px solid #27272a",
				borderRadius: 1.5,
			}}
		>
			<CardContent sx={{ p: 3 }}>
				{/* Status Header */}
				<Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
					<StatusIcon sx={{ color: statusColor, fontSize: 28 }} />
					<Typography variant="h6" sx={{ color: statusColor, fontWeight: 800 }}>
						{statusLabel}
					</Typography>
					{canRerender && (
						<Chip
							label={result.bundle.preset.label}
							size="small"
							sx={{
								bgcolor: "rgba(59, 130, 246, 0.15)",
								color: "#60a5fa",
								fontWeight: 700,
								borderRadius: 0.8,
								fontSize: "0.75rem",
							}}
						/>
					)}
				</Box>

				{/* FAILED: stage + error */}
				{isFailed && (
					<Alert
						severity="error"
						sx={{
							bgcolor: "rgba(239, 68, 68, 0.1)",
							border: "1px solid rgba(239, 68, 68, 0.3)",
							mb: 2,
						}}
					>
						<Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
							Stage: {result.stage}
						</Typography>
						<Typography variant="body2" sx={{ color: "#fca5a5" }}>
							{result.error}
						</Typography>
					</Alert>
				)}

				{/* NEEDS_REVIEW: reasons */}
				{isReview && (
					<Alert
						severity="warning"
						sx={{
							bgcolor: "rgba(245, 158, 11, 0.1)",
							border: "1px solid rgba(245, 158, 11, 0.3)",
							mb: 2,
						}}
					>
						<Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
							Review Required
						</Typography>
						{result.reasons.map((reason) => (
							<Typography
								key={reason}
								variant="body2"
								sx={{ color: "#fbbf24", mb: 0.5 }}
							>
								- {reason}
							</Typography>
						))}
					</Alert>
				)}

				{/* READY / NEEDS_REVIEW: bundle info */}
				{canRerender && (
					<>
						<Divider sx={{ borderColor: "#27272a", my: 2 }} />

						{/* Source metadata */}
						<Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
							<Chip
								label={`Source: ${result.bundle.editPlan.headline}`}
								size="small"
								sx={{
									bgcolor: "#18181b",
									color: "#e4e4e7",
									borderColor: "#27272a",
								}}
							/>
						</Box>

						{/* QC Summary */}
						<Box sx={{ mb: 2 }}>
							<Typography
								variant="caption"
								sx={{ color: "#71717a", fontWeight: 700 }}
							>
								QC SUMMARY
							</Typography>
							<Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
								<Chip
									label={`Pass: ${result.bundle.qc.passedCount}`}
									size="small"
									sx={{
										bgcolor: "rgba(16, 185, 129, 0.15)",
										color: "#34d399",
										fontWeight: 700,
									}}
								/>
								<Chip
									label={`Review: ${result.bundle.qc.reviewCount}`}
									size="small"
									sx={{
										bgcolor: "rgba(245, 158, 11, 0.15)",
										color: "#fbbf24",
										fontWeight: 700,
									}}
								/>
								<Chip
									label={`Fail: ${result.bundle.qc.failedCount}`}
									size="small"
									sx={{
										bgcolor: "rgba(239, 68, 68, 0.15)",
										color: "#f87171",
										fontWeight: 700,
									}}
								/>
							</Box>
						</Box>

						{/* Output paths */}
						<Box sx={{ mb: 2 }}>
							<Typography
								variant="caption"
								sx={{ color: "#71717a", fontWeight: 700 }}
							>
								OUTPUT
							</Typography>
							<Typography
								variant="body2"
								sx={{
									color: "#a1a1aa",
									fontFamily: "monospace",
									fontSize: "0.75rem",
									mt: 0.5,
								}}
							>
								{result.bundle.videoPath}
							</Typography>
							<Typography
								variant="body2"
								sx={{
									color: "#a1a1aa",
									fontFamily: "monospace",
									fontSize: "0.75rem",
								}}
							>
								{result.bundle.coverPath}
							</Typography>
						</Box>
					</>
				)}

				{/* Actions */}
				<Box sx={{ display: "flex", gap: 1, mt: 2, flexWrap: "wrap" }}>
					{canRerender && (
						<Button
							variant="contained"
							startIcon={<FolderOpenIcon />}
							onClick={() => onOpenOutput(result.bundle.videoPath)}
							sx={{
								bgcolor: "#3b82f6",
								fontWeight: 700,
								textTransform: "none",
								borderRadius: 1,
								"&:hover": { bgcolor: "#2563eb" },
							}}
						>
							Open Output
						</Button>
					)}
					{canRerender && (
						<Button
							variant="outlined"
							onClick={onRenderAgain}
							sx={{
								borderColor: "#27272a",
								color: "#e4e4e7",
								bgcolor: "#18181b",
								fontWeight: 600,
								textTransform: "none",
								borderRadius: 1,
								"&:hover": { borderColor: "#3b82f6", color: "#60a5fa" },
							}}
						>
							Render Again
						</Button>
					)}
					{canRerender && (
						<Button
							variant="outlined"
							onClick={onRegenerate}
							sx={{
								borderColor: "#27272a",
								color: "#e4e4e7",
								bgcolor: "#18181b",
								fontWeight: 600,
								textTransform: "none",
								borderRadius: 1,
								"&:hover": { borderColor: "#3b82f6", color: "#60a5fa" },
							}}
						>
							Regenerate
						</Button>
					)}
					{canRerender && (
						<Tooltip title="Studio integration coming in a future slice">
							<span>
								<Button
									variant="outlined"
									disabled
									sx={{
										borderColor: "#27272a",
										color: "#52525b",
										bgcolor: "#18181b",
										fontWeight: 600,
										textTransform: "none",
										borderRadius: 1,
										cursor: "not-allowed",
									}}
								>
									Open in Studio
								</Button>
							</span>
						</Tooltip>
					)}
					{isFailed && (
						<Button
							variant="outlined"
							onClick={onNewJob}
							sx={{
								borderColor: "#27272a",
								color: "#e4e4e7",
								bgcolor: "#18181b",
								fontWeight: 600,
								textTransform: "none",
								borderRadius: 1,
								"&:hover": { borderColor: "#3b82f6", color: "#60a5fa" },
							}}
						>
							New Job
						</Button>
					)}
				</Box>
			</CardContent>
		</Card>
	);
}
