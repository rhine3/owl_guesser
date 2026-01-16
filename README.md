# Pairwise North American owl quiz

This website enables users to rank owls using pairwise comparisons.

### LLM Disclaimer

I used GPT-5 mini to help build this website.

### About the app

This app is based on an original, text input-based Python app (more info below). It features several enhancements over the original app:
- There are images and a user interface!
- It is a static javascript app that can be deployed via GitHub pages, and requires no Python to run.
- The user select the winner for each matchup by either clicking the winner's button or entering 1 or 2 on their keyboard.
-  It offers options to rank owls both by the sum of their win/loss records and by their Bradley-Terry score.



### Original text-based Python implementation
The original Python implementation is as follows

```
import numpy as np
import pandas as pd
import choix

# Create an owl-choice app
# Owls to choose between
na_owls = [
    "Barn Owl",
    "Flammulated Owl",
    "Western Screech Owl",
    "Whiskered Screech Owl",
    "Eastern Screech Owl",
    "Snowy Owl",
    "Great Horned Owl",
    "Spotted Owl",
    "Barred Owl",
    "Great Gray Owl",
    "Northern Hawk Owl",
    "Ferruginous Pygmy Owl",
    "Northern Pygmy Owl",
    "Elf Owl",
    "Burrowing Owl",
    "Boreal Owl",
    "Northern Saw-whet Owl",
    "Long-eared Owl",
    "Short-eared Owl"
]

# Create a dataframe of each owl
owls = {owl:np.nan for owl in na_owls}
owl_indices = {owl:idx for idx, owl in enumerate(na_owls)}

# Create list of all owl pairs
owl_pairs = [(owl, other_owl) for idx, owl in enumerate(na_owls) for other_owl in na_owls[idx+1:]]
owl_pair_winners = []

# Randomize the order of the pairs
np.random.shuffle(owl_pairs)

# Do each pairwise comparison
for idx, (owl, other_owl) in enumerate(owl_pairs):
    if len(owl_pair_winners) > 0:    
        n_items = len(na_owls)
        mean, cov = choix.ep_pairwise(n_items, owl_pair_winners, 0.1, model="logit")

        # If mean for one owl is much higher than the other, skip the comparison
        if abs(mean[owl_indices[owl]] - mean[owl_indices[other_owl]]) > 5:
            print(f"Skipping {owl} vs. {other_owl} - winner: {owl if mean[owl_indices[owl]] > mean[owl_indices[other_owl]] else other_owl}")
            continue

    choice = input(f"Which owl do you prefer, (1) {owl} or (2) {other_owl}? (Enter 1 or 2)")
    if choice == "1":
        owl_pair_winners.append((owl_indices[owl], owl_indices[other_owl]))
    elif choice == "2":
        owl_pair_winners.append((owl_indices[other_owl], owl_indices[owl]))
    else:
        print("Invalid choice. Please choose one of the two owls.")
owl_pair_winners

# Display birds by rank
na_owls_ranked = sorted(zip(na_owls, mean), key=lambda x: x[1], reverse=True)

print("Your Owl Rank:")
_ = [print(idx+1, owl) for idx, (owl, _) in enumerate(na_owls_ranked)]
```

