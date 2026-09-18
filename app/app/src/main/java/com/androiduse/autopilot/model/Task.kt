package com.androiduse.autopilot.model

import com.google.gson.annotations.SerializedName

data class Task(
    @SerializedName("id")
    val id: String,

    @SerializedName("goal")
    val goal: String,

    @SerializedName("userId")
    val userId: String?,

    @SerializedName("status")
    val status: String,

    @SerializedName("totalSteps")
    val totalSteps: Int,

    @SerializedName("createdAt")
    val createdAt: String,

    @SerializedName("completedAt")
    val completedAt: String?,

    @SerializedName("error")
    val error: String?,

    @SerializedName("response")
    val response: String?,

    @SerializedName("device")
    val device: TaskDevice,

    @SerializedName("user")
    val user: TaskUser?,

    @SerializedName("_count")
    val count: TaskCount
)

data class TaskDevice(
    @SerializedName("id")
    val id: String,

    @SerializedName("name")
    val name: String,

    @SerializedName("deviceId")
    val deviceId: String
)

data class TaskUser(
    @SerializedName("id")
    val id: String,

    @SerializedName("name")
    val name: String?,

    @SerializedName("email")
    val email: String?
)

data class TaskCount(
    @SerializedName("taskSteps")
    val taskSteps: Int
)

data class TasksResponse(
    @SerializedName("tasks")
    val tasks: List<Task>
)
