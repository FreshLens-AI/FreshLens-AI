# FreshLens ML

The V1 pipeline uses two whole-image classifiers because the mobile capture flow
allows one produce type per photo. Identity-v1 covers `banana`, `cucumber`,
`eggplant`, `tomato`, and an `unknown` rejection class. Freshness-v1 grades an
accepted identity as `fresh`, `medium`, or `spoiled`. Images rejected by Model 1
are not sent to Model 2 and are stored without a freshness grade.

## Identity dataset

Identity-v1 combines selected canonical classes from Fruits-360 with the
real-world, three-stage AgriFreshNET images. Other AgriFreshNET produce types
become the `unknown` class. The preparation script groups all augmented variants
of an AgriFreshNET source image into one split and keeps Fruits-360 as
supplemental training-only data.

Sources used for the current baseline:

- Fruits-360 100x100, revision `a638d50ae5ebe4c4001fe6a8e091e0253e1168fd`
  (CC BY-SA 4.0). Although its name says “fruits”, it also contains vegetables,
  including cucumber, eggplant, and tomato.
- AgriFreshNET v1, `Processed_Data.zip`, DOI `10.17632/42m5tb7yv9.1`
  (CC BY 4.0), SHA-256
  `6607a48bf2817f9dfc8d4a1c32ce663c1d8308b4b1251e9bf65f074fcac53f11`.
- Kritik Seth's Fruits and Vegetables Image Recognition dataset (CC0), using
  Hugging Face conversion revision `dcd4a762672597eb73c630fc9017e8ae93401dc7`.
  Its upstream train split adds varied web photos; its deduplicated upstream
  test split is an independent release gate.

Download the AgriFreshNET processed archive from its DOI page and extract it
under `data/ml-sources/agrifreshnet/extracted`. Clone Fruits-360 under
`data/ml-sources/fruits-360-100x100`; a sparse checkout of only directories
whose names begin with Banana, Cucumber, Eggplant, or Tomato is sufficient.

```bash
python -m training.prepare_identity_dataset \
  --fruits360-root ../../data/ml-sources/fruits-360-100x100 \
  --agrifresh-root ../../data/ml-sources/agrifreshnet/extracted \
  --output ../../data/ml-datasets/identity-v1

python -m training.prepare_external_dataset \
  --parquet ../../data/ml-sources/fruit-vegetable-recognition/train-*.parquet \
  --split train --validation-percent 20 \
  --output ../../data/ml-datasets/identity-external-train-v2

python -m training.prepare_external_dataset \
  --parquet ../../data/ml-sources/fruit-vegetable-recognition/test.parquet \
  --split test \
  --exclude-manifest ../../data/ml-datasets/identity-external-train-v2/manifest.csv \
  --output ../../data/ml-datasets/identity-cross-domain-v4

python -m training.merge_identity_dataset \
  --base ../../data/ml-datasets/identity-v1 \
  --external-train ../../data/ml-datasets/identity-external-train-v2 \
  --output ../../data/ml-datasets/identity-v3
```

The generated `manifest.csv` records provenance and grouping. The generated
`dataset-summary.json` records class counts, licences, and source URLs. Dataset
images and model weights are gitignored; do not commit third-party image data.

## Freshness dataset

Freshness-v1 uses the 12 AgriFreshNET folders formed by four supported products
and three stages: Fresh, Semi Fresh, and Rotten. The labels are mapped to
`fresh`, `medium`, and `spoiled`. All offline augmentations derived from the same
source filename stay in the same split, and validation/test contain only the
unaugmented source photos.

```bash
python -m training.prepare_freshness_dataset \
  --agrifresh-root ../../data/ml-sources/agrifreshnet/extracted \
  --output ../../data/ml-datasets/freshness-v1
```

The current prepared set has 5,039 training images, 407 validation images, and
413 held-out test images after removing 11 exact duplicates. These evaluation
splits test unseen source groups, but they remain from the same public dataset;
phone-captured images are still required for the release test.

## Train and evaluate

Use an exact, recorded Ultralytics/PyTorch environment and a CUDA device for the
final run. A CPU run is suitable only as an integration baseline.

```bash
python -m training.train_identity \
  --data ../../data/ml-datasets/identity-v3 \
  --epochs 80 \
  --imgsz 160 \
  --device 0 \
  --project ../../runs/identity \
  --name identity-yolo26n-cls-v1

python -m training.evaluate_identity \
  --weights ../../runs/identity/identity-yolo26n-cls-v1/weights/best.pt \
  --data ../../data/ml-datasets/identity-v3 \
  --imgsz 160 \
  --output ../../runs/identity/identity-yolo26n-cls-v1/test-metrics.json

python -m training.evaluate_identity \
  --weights ../../runs/identity/identity-yolo26n-cls-v1/weights/best.pt \
  --data ../../data/ml-datasets/identity-cross-domain-v4 \
  --imgsz 160 --confidence-threshold 0.75 \
  --output ../../runs/identity/identity-yolo26n-cls-v1/cross-domain-metrics.json
```

Do not report the Fruits-360 default split as the final result: adjacent frames
share controlled backgrounds and physical specimens. A checkpoint must also
pass the deduplicated cross-domain split. Even then, the final report must
include a team-captured, device-diverse local test set; public web datasets can
contain unrecorded near-duplicates and do not reproduce the app's camera flow.

To activate a checkpoint locally, copy it to `models/identity-v1.pt`, then
copy the freshness checkpoint to `models/freshness-v1.pt` and build the worker.
The worker applies configurable `IDENTITY_MIN_CONFIDENCE` (0.75) and
`FRESHNESS_MIN_CONFIDENCE` (0.50) gates. A rejected identity is completed
without a grade; a rejected freshness prediction fails safely and asks for a
retake.

Train and evaluate Model 2 with:

```bash
python -m training.train_freshness \
  --data ../../data/ml-datasets/freshness-v1 \
  --epochs 60 --imgsz 224 --device 0 \
  --project ../../runs/freshness \
  --name freshness-yolo26n-cls-v1

python -m training.evaluate_freshness \
  --weights ../../runs/freshness/freshness-yolo26n-cls-v1/weights/best.pt \
  --data ../../data/ml-datasets/freshness-v1 \
  --imgsz 224 --confidence-threshold 0.50 \
  --output ../../runs/freshness/freshness-yolo26n-cls-v1/test-metrics.json
```

## SnapStock-AI / Fahad et al. (CMC 2022) Dataset & Colab Training

To eliminate the cross-domain generalization gap and provide dense sample strata across all 3 freshness stages (`fresh`, `medium`, `spoiled`), the pipeline integrates the **SnapStock-AI** Hugging Face dataset (`SnapStock-AI/snapstock-freshness-dataset-v2`).

### 1. 1-Click Google Colab GPU Training (Recommended)

Open [`packages/ml/notebooks/train_fl2tc_colab.ipynb`](notebooks/train_fl2tc_colab.ipynb) in Google Colab:
- Select a GPU runtime (T4, L4, or A100).
- Provide your `HF_TOKEN` in Colab **Secrets** or interactive input.
- Click **Runtime -> Run all**.
- The notebook downloads the dataset, formats YOLO splits, trains both Model 1 and Model 2 using `yolo11s-cls`, evaluates on held-out test data, and automatically downloads the release archive `freshlens-fl2tc-v2-artifacts.zip`.

### 2. Local / Headless CLI Pipeline

```bash
# 1. Download & format SnapStock dataset into YOLO splits
python -m training.dataset_snapstock \
  --repo-id SnapStock-AI/snapstock-freshness-dataset-v2 \
  --output-dir ../../data/ml-datasets/snapstock-fl2tc \
  --token $HF_TOKEN

# 2. Train Model 1 (Identity)
python -m training.train_identity \
  --data ../../data/ml-datasets/snapstock-fl2tc/identity \
  --model yolo11s-cls.pt \
  --epochs 80 --imgsz 224 --device 0 \
  --project ../../runs/identity \
  --name identity-yolo11s-cls-v2

# 3. Train Model 2 (Freshness)
python -m training.train_freshness \
  --data ../../data/ml-datasets/snapstock-fl2tc/freshness \
  --model yolo11s-cls.pt \
  --epochs 70 --imgsz 224 --device 0 \
  --project ../../runs/freshness \
  --name freshness-yolo11s-cls-v2

# 4. Unified FL-2TC evaluation and metrics report
python -m training.evaluate_fl2tc \
  --identity-weights ../../runs/identity/identity-yolo11s-cls-v2/weights/best.pt \
  --freshness-weights ../../runs/freshness/freshness-yolo11s-cls-v2/weights/best.pt \
  --dataset-dir ../../data/ml-datasets/snapstock-fl2tc \
  --split test \
  --output-dir ../../runs/eval
```

