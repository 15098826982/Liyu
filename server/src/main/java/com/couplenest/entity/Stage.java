package com.couplenest.entity;

import lombok.Data;

/**
 * 目标阶段（wish 模式用），以 JSON 数组存放在 goal.stages。
 */
@Data
public class Stage {

    /** 阶段文字 */
    private String text;

    /** 是否已完成 */
    private boolean completed;

    public Stage() {
    }

    public Stage(String text, boolean completed) {
        this.text = text;
        this.completed = completed;
    }
}
