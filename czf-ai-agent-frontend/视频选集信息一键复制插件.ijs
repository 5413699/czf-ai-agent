// ==UserScript==
// @name         Bilibili 视频选集信息复制
// @namespace    https://www.bilibili.com/
// @version      1.0
// @description  提取 B 站视频选集标题和时长并复制到剪贴板
// @author       You
// @match        *://*.bilibili.com/video/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 创建复制按钮
    const copyBtn = document.createElement('button');
    copyBtn.textContent = '复制选集信息';
    copyBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        background-color: #FF80AB;
        color: white;
        padding: 10px 16px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.3s ease;
    `;
    copyBtn.addEventListener('mouseenter', () => {
        copyBtn.style.backgroundColor = '#FF4D88';
    });
    copyBtn.addEventListener('mouseleave', () => {
        copyBtn.style.backgroundColor = '#FF80AB';
    });

    // 按钮点击事件：提取并复制选集信息
    copyBtn.addEventListener('click', () => {
        // 1. 定位标题和时长元素
        const titleElements = document.querySelectorAll('.title-txt');
        const durationElements = document.querySelectorAll('.stat-item.duration');

        // 2. 提取文本内容
        const titles = Array.from(titleElements).map(el => el.textContent.trim());
        const durations = Array.from(durationElements).map(el => el.textContent.trim());

        // 3. 校验数据
        if (titles.length === 0 || durations.length === 0 || titles.length !== durations.length) {
            alert('未找到有效选集信息或标题/时长数量不匹配，请检查页面结构');
            return;
        }

        // 4. 拼接内容
        const content = titles.map((title, index) => `${title} ${durations[index]}`).join('\n');

        // 5. 复制到剪贴板
        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();

        try {
            const success = document.execCommand('copy');
            if (success) {
                alert(`已复制 ${titles.length} 条选集信息\n\n${content}`);
            } else {
                alert('复制失败，请手动复制：\n' + content);
            }
        } catch (error) {
            alert('复制失败，请手动复制：\n' + content);
        } finally {
            document.body.removeChild(textarea);
        }
    });

    // 将按钮添加到页面
    document.body.appendChild(copyBtn);
})();