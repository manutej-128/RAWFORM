#!/usr/bin/env python3
"""JSON adapter around tools/deslop.py for RAWFORM.

Reads the text to analyse from stdin and prints a JSON object with the
real detector score, word count and grouped findings. Detection logic lives
in deslop.py and is imported unchanged.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import deslop


def main():
    text = sys.stdin.read()
    normalised = deslop.normalise(text)
    if not normalised.split():
        print(json.dumps({"error": "no visible copy to score", "score": None}))
        return

    hits = deslop.audit(normalised)

    weights = {"vocab": 1, "phrases": 1, "punctuation": 1, "rhythm": 1, "proof": 1}
    failed = [k for k, v in hits.items() if v]
    score = 5 - sum(weights[k] for k in failed)
    score = max(0, score)

    titles = {
        "vocab": "AI vocabulary",
        "phrases": "AI constructions",
        "punctuation": "punctuation cadence",
        "rhythm": "rule-of-three rhythm",
        "proof": "possible invented proof",
    }

    categories = []
    for key in ("proof", "phrases", "vocab", "punctuation", "rhythm"):
        items = hits[key]
        if not items:
            continue
        counts = {}
        examples = {}
        for item in items:
            if isinstance(item, tuple):
                label = str(item[0])
                if key in ("vocab", "phrases") and len(item) > 1 and isinstance(item[1], int):
                    counts[label] = counts.get(label, 0) + item[1]
                else:
                    counts[label] = counts.get(label, 0) + 1
                    if label not in examples and len(item) > 1:
                        examples[label] = item[1]
            else:
                label = str(item)
                counts[label] = counts.get(label, 0) + 1
        cat_items = []
        for label, count in counts.items():
            entry = {"phrase": label, "count": count}
            if label in examples and isinstance(examples[label], str):
                entry["example"] = examples[label]
            cat_items.append(entry)
        categories.append({"key": key, "title": titles[key], "items": cat_items})

    result = {
        "score": score,
        "wordCount": len(normalised.split()),
        "categories": categories,
        "clean": score == 5,
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()