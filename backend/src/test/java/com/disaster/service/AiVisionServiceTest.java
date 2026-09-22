package com.disaster.service;

import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AiVisionServiceTest {

    @Test
    void labelComesFromScoreAndEachBaselineLandsInItsOwnBand() {
        // The baselines the app uses for reported severities must round-trip to the same label.
        assertThat(AiVisionService.labelFor(0.9)).isEqualTo("CRITICAL");
        assertThat(AiVisionService.labelFor(0.7)).isEqualTo("HIGH");
        assertThat(AiVisionService.labelFor(0.5)).isEqualTo("MEDIUM");
        assertThat(AiVisionService.labelFor(0.25)).isEqualTo("LOW");
    }

    @Test
    void scoreAndLabelCanNoLongerContradictEachOther() {
        // Observed from qwen2.5vl:3b on a real flood photo: score 0.7 with label "MEDIUM".
        assertThat(AiVisionService.labelFor(0.7)).isEqualTo("HIGH");
        assertThat(AiVisionService.labelFor(0.0)).isEqualTo("LOW");
        assertThat(AiVisionService.labelFor(1.0)).isEqualTo("CRITICAL");
    }

    @Test
    void fillerEntriesAreDroppedButRealOnesKept() {
        // Observed on a real fire photo: ["large smoke cloud", "unstable structures", "none visible"]
        assertThat(AiVisionService.withoutFiller(List.of("large smoke cloud", "none visible", "N/A", "  Not visible. ", "fire trucks")))
                .containsExactly("large smoke cloud", "fire trucks");
    }

    @Test
    void listOfOnlyFillerBecomesEmptySoTheUiHidesIt() {
        assertThat(AiVisionService.withoutFiller(List.of("None visible"))).isEmpty();
        assertThat(AiVisionService.withoutFiller(null)).isEmpty();
        assertThat(AiVisionService.withoutFiller(Arrays.asList(null, " ", "-"))).isEmpty();
    }

    @Test
    void wordsThatMerelyContainNoneAreNotFiller() {
        assertThat(AiVisionService.withoutFiller(List.of("nonetheless, water rising"))).hasSize(1);
    }
}
