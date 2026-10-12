package com.couplenest.controller;

import com.couplenest.common.Result;
import com.couplenest.dto.UserSetRoleRequest;
import com.couplenest.dto.UserUpdateProfileRequest;
import com.couplenest.dto.UserVO;
import com.couplenest.entity.User;
import com.couplenest.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 用户接口。需要登录态。
 */
@RestController
@RequestMapping("/user")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public Result<UserVO> me() {
        return Result.ok(toVO(userService.getCurrentUser()));
    }

    @PostMapping("/updateProfile")
    public Result<UserVO> updateProfile(@RequestBody UserUpdateProfileRequest request) {
        return Result.ok(toVO(userService.updateProfile(request)));
    }

    @PostMapping("/setRole")
    public Result<UserVO> setRole(@Valid @RequestBody UserSetRoleRequest request) {
        return Result.ok(toVO(userService.setRole(request.getRole())));
    }

    private UserVO toVO(User user) {
        UserVO vo = new UserVO();
        vo.setId(user.getId());
        vo.setOpenid(user.getOpenid());
        vo.setNickname(user.getNickname());
        vo.setAvatar(user.getAvatar());
        vo.setFamilyId(user.getFamilyId());
        vo.setRole(user.getRole());
        return vo;
    }
}
